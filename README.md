# 弈见 · Gomoku Studio

浏览器运行的五子棋项目。仅支持玩家与 AI 对弈。可使用 ChatGPT 套餐授权，或配置 OpenAI 兼容 API。支持思考强度设置、完整棋谱保存、逐手回放、AI 赛后复盘和分段耗时日志。

此目录为独立的 1.1 开发版，默认使用 **3211** 端口和自己的 `.local/` 数据目录。不会接管 3210，也不会复制或更改旧版的账户和棋局。浏览器会话 Cookie 按端口隔离。

## 启动

安装 Node.js 22 或更新版本。Windows 双击 `start.cmd`，或在项目目录执行：

```sh
npm install
npm start
```

Windows 的 `start.cmd` 会在后台启动服务，确认就绪后打开浏览器；关闭启动窗口不会关闭服务。再次双击会复用已运行的实例。启动器会在确认旧进程不存在后自动清理遗留锁。启动日志保存在 `.local/server.stdout.log` 和 `.local/server.stderr.log`。

浏览器打开 **http://127.0.0.1:3211**。请使用 `127.0.0.1`，不要换成 `localhost`。

1. 打开「设置」，点击 **Continue with ChatGPT**。
2. 在 OpenAI 官方页面登录，授权此应用使用 ChatGPT 套餐。
3. 返回后关闭套餐提示，打开设置，选择账户实际返回的对手模型和执子，保存。
4. 开始新棋局。棋局结束或认输后点击「复盘棋局」。
5. 点击复盘建议卡片，跳转到对应落子之前的局面，绿色标记显示推荐落点。也可通过滑块或落子列表逐步回看。

## ChatGPT Pro 套餐接入

选择「ChatGPT 套餐」时，使用 OpenAI 官方 **Sign in with ChatGPT / ChatGPT plan usage** 本地应用流程，无需 API Key，不通过 ChatGPT 私有接口，不读取 Codex 登录凭据。API 模式则使用你单独输入的服务商 Token。

截至 2026-10-13 的官方文档说明，本地与开源应用可以动态注册 OAuth 客户端，请求 `chatgpt.tokens.use.direct` 权限，并使用 OAuth token 调用公共 Responses API。Pro 账户实际可用性、模型列表及应用额度取决于官方授权结果；不保证无限调用，也不会自动退回单独计费的 API Key。请在 ChatGPT 用量设置中检查是否允许额外 credits 使用。

- [套餐使用与适用范围](https://developers.openai.com/siwc/token-sharing-open-source)
- [注册和登录](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [模型和推理](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [预览限制](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
- [管理用量](https://chatgpt.com/settings/usage)

这是本机运行的源码项目。公开托管、商业部署的 ChatGPT 套餐接入需要单独满足 OpenAI 对该类应用的要求，本项目未实现公网多人服务。

## API 连接

设置 → 连接方式 →「API · 自定义连接」。输入 **Base URL**（例如 `https://api.openai.com/v1`）、**Token** 和协议，点击「连接并获取模型 ID」，从返回的模型列表中选择模型后保存。Base URL 应包含服务商要求的版本路径，不包含 `/models`、`/responses` 或 `/chat/completions`。

支持标准 `GET /models` 的 `data[].id`，也支持 `models[].slug`。推理支持流式 Chat Completions 和 Responses。服务商若使用其他认证头、非标准协议或未实现模型列表接口，则需要单独适配。API 用量由该服务商计费，不使用 ChatGPT Pro 套餐额度。

Token 保存于本地（Windows 使用 DPAPI 加密，Unix 使用受限文件权限），保存后不回显、不写入耗时日志；同一连接留空可保留原 Token，更换地址或协议需重新输入。连接校验成功后才覆盖旧连接，失败不替换。棋局绑定创建时的连接方式与 API 地址/协议，切换设置不会把旧棋谱发到另一服务商。

## 思考强度

设置 →「思考强度」：默认不发送该参数；其他档位在 Responses 中发送 `reasoning.effort`，在 Chat Completions 中发送 `reasoning_effort`。ChatGPT 模式严格采用账户模型目录返回的档位。API 未声明能力时提供常见的低/中/高档，并明确标为未验证；接口拒绝参数时可改回默认，不会静默忽略设置。

模型与执子对新棋局生效。勾选「同时应用到当前棋局的下一次 AI 请求」可更新本局强度，前提是所选连接方式和模型与本局一致。正在进行的 AI 请求不会被修改。旧棋谱缺少强度字段时仍用模型默认。

## 分段耗时日志

日志位于 `.local/timing.jsonl`。在项目目录执行 `npm run timings` 可查看最近 20 次落子/复盘请求的摘要。也可用 PowerShell 实时查看：

```powershell
Get-Content .local/timing.jsonl -Wait -Tail 30
```

每条记录包括时间、请求 ID、阶段名和从本地收到请求开始累计的 `elapsedMs`。同一请求下可关联模型、连接方式、思考强度、手数，以及每次重试的 `attempt`。不记录 Token、授权头、提示词、模型输出正文或推理过程。

主要阶段：模型目录检查 → 棋谱准备 → 授权检查/刷新 → 发出上游请求 → 收到响应头 → 首字节 → 首事件 → 首段文本 → 生成完成 → 数据流结束 → JSON 解析 → 合法性校验 → 保存棋谱 → 本地响应结束。`retry_scheduled` 标记非法落点引起的重试；失败也保存 `attempt_summary`。供应商返回 usage 时记录输入、输出和 reasoning token 的数量，缺少则不伪造。

`attempt_summary` 中 `headersMs`、`firstByteMs`、`firstEventMs`、`firstTextMs`、`completedMs` 均从发出该次上游请求起累计；`streamTailMs` 仅表示生成完成到流结束的额外等待，`credentialsMs` 表示本次授权检查耗时。这些等待包含网络、排队与服务端处理，**不能当作纯模型思考时间**；某些服务商会缓冲事件。

日志只追加、不自动轮转；长期运行时可在停止该实例后归档日志。

## 功能与规则

- 15×15 自由五子棋：无禁手，任一方向连续至少五子获胜；黑棋先行。
- 可选执黑或执白；执白时由所选 AI 先下。
- 服务端裁定合法落子、回合、胜负和和棋；不提供双人或本地算法代下模式。
- AI 非法落子自动重新询问一次；仍失败时保留棋局，允许手动重试。
- 每次请求包含完整棋谱和棋盘。Responses 只在收到 `response.completed` 后采纳；Chat Completions 要求正常 `stop` 和 `[DONE]`，截断或中断不采纳。
- 棋谱保存到本机，重启可继续。断网、超时与额度不足不会清空棋局。
- 赛后复盘指出最早可改进的玩家手数、关键失误、合法替代点和训练建议；复盘缓存后可重复查看。
- 支持多个已授权账户切换。模型列表从当前账户获取，不硬编码模型名称。
- 模型与执子变化只影响新棋局；旧棋局继续使用创建时模型，思考强度可选择同步。切换账户后若旧模型不可用，需切回能使用该模型的账户。

## 数据与凭据

运行数据存于 `.local/`（已加入 `.gitignore`）。棋谱与设置为 JSON；Windows 的凭据使用当前 Windows 用户的 DPAPI 加密，Unix 使用受限目录与 `0600` 文件权限。保存的令牌不回传前端，不放入 localStorage，不进入日志；API Token 输入成功后立即清空输入框。localStorage 仅保存已读套餐提示的标记。

OAuth 使用 PKCE、一次性 state、nonce、JWT 签名/issuer/audience/exp 校验。服务仅绑定 `127.0.0.1`，校验 Host、Origin、CSRF token，并使用 HttpOnly 会话 cookie。退出登录尝试远程撤销并清理本地令牌。一个数据目录只允许一个服务进程，防止 refresh token 并发轮换。

可以通过 `PORT` 更改端口，通过 `GOMOKU_DATA_DIR` 改变数据路径。默认端口为 3211。若进程异常被强制结束而遗留 `.local/server.lock`，先确认没有实例在运行，再删除这个锁文件后启动。

## 测试

```sh
npm test
```

测试覆盖胜负判定、非法落子、棋谱验证、复盘合法性、流式完成与失败、OAuth 状态及身份验证。模拟测试不会消耗套餐；真实 OAuth 登录和模型访问必须由用户完成官方授权后验证；API 双协议的端到端测试使用本地模拟服务，不消耗真实额度。

AI 棋力与复盘质量取决于所选模型；本项目不宣称专业棋力引擎或必胜分析。AI 请求最多等待 4 分钟，可在超时后重试。

## 项目结构

`public/` 为无构建依赖的浏览器前端；`server.mjs` 为 HTTP 服务；`lib/` 包含 OAuth、存储、AI 和棋局规则；`test/` 为 Node 内置测试。
