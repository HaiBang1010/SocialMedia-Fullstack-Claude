# Working with Claude — Hướng dẫn chuyên sâu

> Mục tiêu: từ "user của Claude" thành "AI engineer biết khai thác Claude đúng cách".
>
> Đọc theo thứ tự. Mỗi phần ~5-10 phút. Có ví dụ thực hành ở cuối từng phần.

---

## Phần 1 — Mental model: hiểu Claude trước khi dùng

Đa số bug khi prompt đến từ **giả định sai về cách Claude hoạt động**. 5 sự thật quan trọng nhất:

### 1.1 Context window là TẤT CẢ Claude "biết" trong một cuộc trò chuyện

Mỗi lần gửi message, Claude đọc **toàn bộ** lịch sử chat + system prompt + tools available + uploaded files. Đó là "context window". Hết context → Claude bắt đầu quên đầu cuộc trò chuyện.

**Hệ quả:**
- Cuộc trò chuyện càng dài, càng tốn token và càng dễ "lạc"
- Mở chat mới = Claude không biết gì về chat cũ (trừ khi bật Memory hoặc dùng Projects)
- File upload nặng = ăn rất nhiều context

**Quy tắc:**
- Task lớn → chia thành conversations riêng, mỗi cái tập trung 1 việc
- Đừng paste 10000 dòng code rồi hỏi 1 câu nhỏ — extract phần liên quan thôi

### 1.2 Knowledge cutoff: Claude không biết thời sự

Claude của tôi (Opus 4.7) có cutoff là cuối tháng 1/2026. Bất cứ chuyện gì sau đó — sản phẩm mới, tin tức, version library mới — Claude **không biết** nếu không search.

**Mẹo:** Nếu hỏi về thư viện/framework mới, version mới, hoặc thứ thay đổi nhanh → bảo Claude search trước, hoặc tự dán docs vào.

### 1.3 Claude không "biết" — Claude "gọi tools"

Khi Claude lấy tin tức, đọc file, chạy code, vẽ UI — không phải Claude "biết". Claude **gọi tool** mà environment cung cấp. Trên Claude.ai có sẵn: web_search, code execution, file creation, image generation, MCP connectors. Trên API thì developer tự define tools.

**Hệ quả:** Cùng một câu hỏi, Claude trên Claude.ai có thể trả khác Claude trên API — vì tools khác nhau.

### 1.4 Claude là stateless giữa các conversations

Mặc định, mỗi cuộc trò chuyện là một slate trắng. Nếu hôm qua bạn dạy Claude một quy ước, hôm nay phải dạy lại — TRỪ KHI:
- **Memory**: feature opt-in trong Settings, Claude tự nhớ thông tin về bạn qua chat
- **Projects**: tạo project, viết "project instructions" — mọi chat trong project đều dùng instructions đó
- **Search past chats**: Claude có thể search qua các chat cũ (gần đây Anthropic mới thêm)

### 1.5 Claude có thể được "đào tạo lại" trong runtime qua skills, system prompts, MCP

Đây là chìa khóa của AI engineering: bạn KHÔNG fine-tune model — bạn **shape behavior** qua context. Skills, MCP, subagents, custom system prompts đều là cách làm điều này. Phần sau sẽ đi sâu.

---

## Phần 2 — Hệ sinh thái Anthropic: 4 sản phẩm, dùng cái nào khi nào

| Sản phẩm | Dạng | Dùng khi nào |
|---|---|---|
| **Claude.ai** | Web/mobile chat | Tasks hằng ngày: viết, brainstorm, research, code review |
| **Claude Desktop** | App desktop | Cùng Claude.ai + có thể cài MCP servers local (đọc file, control desktop) |
| **Claude Code** | CLI tool | Coding agentic — Claude tự đọc/sửa code, chạy test, commit. Cần Node.js |
| **Claude API** | REST API | Build app riêng tích hợp Claude |

**Khi nào nên dùng cái gì:**
- Học, viết, suy luận → **Claude.ai**
- Code dự án thực tế (như cái social media này) → **Claude Code** (chạy trong terminal của project)
- Cần connect Claude với Gmail/Slack/Notion local → **Claude Desktop** với MCP
- Build chatbot cho user → **Claude API**

> Trang này: https://claude.com/product để xem chi tiết sản phẩm.
> Docs API: https://docs.claude.com
> Docs Code: https://docs.claude.com/en/docs/claude-code/overview

---

## Phần 3 — Skills: dạy Claude một workflow cụ thể

### 3.1 Skill là gì

**Skill** là một folder chứa file `SKILL.md` (và optional script/tài liệu phụ) — Claude sẽ tự load nó khi gặp task phù hợp. Coi như một "expansion pack" cho Claude.

Ví dụ: pre-built skill `pdf` của Anthropic có:
- `SKILL.md`: hướng dẫn Claude cách xử lý PDF (extract text, fill form, merge)
- Python scripts để Claude chạy
- Templates

Khi user yêu cầu "extract form fields từ file PDF này", Claude tự đọc skill và biết cách làm. **Không phải Claude đã "biết" — skill dạy nó.**

### 3.2 Cấu trúc một skill

```
my-skill/
├── SKILL.md              # bắt buộc — instructions + metadata
├── scripts/              # optional — code Claude có thể chạy
│   └── helper.py
└── reference/            # optional — docs phụ
    └── examples.md
```

`SKILL.md` có YAML frontmatter ở đầu:

```markdown
---
name: my-skill
description: "Use this skill when user wants to [TASK]. Triggers on keywords X, Y, Z."
---

# My Skill

## When to use
- Task A
- Task B (NOT task C)

## Workflow
1. First, read the input file
2. Then run scripts/helper.py
3. Format output as JSON

## Constraints
- Never modify files outside /workspace
```

**Quy tắc viết skill tốt:**
- `description` cực kỳ quan trọng — Claude dựa vào đó để quyết định CÓ load skill không. Viết rõ KHI NÀO dùng và KHI NÀO không.
- Instructions ngắn gọn, action-oriented
- Bundle script khi tác vụ deterministic (parse PDF, validate JSON) — đỡ tốn token và chính xác hơn

### 3.3 Pre-built skills của Anthropic

Trên Claude.ai paid plan và Claude Code, đã có sẵn:
- **docx** — tạo/sửa Word documents
- **pptx** — tạo PowerPoint
- **xlsx** — tạo Excel với formulas, charts
- **pdf** — tạo, fill, merge PDF
- **frontend-design** — design web UI
- **canvas-design** — design poster/art

Khi bạn nói "tạo slide deck giới thiệu sản phẩm", Claude tự load `pptx` skill — không cần dạy.

### 3.4 Tạo custom skill cho team/project

Trường hợp dùng: bạn muốn Claude luôn viết commit message theo Conventional Commits. Thay vì paste rule mỗi lần → tạo skill.

**Cách tạo:**
- **Trong Claude.ai**: Settings → Capabilities → Skills → Create new skill
- **Trong Claude Code**: viết file `SKILL.md` trong `.claude/skills/<skill-name>/`
- **Trong API**: pass skill files trong request

**Ví dụ skill thực tế cho project social media:**

```markdown
---
name: prisma-schema-update
description: "Use when user asks to modify Prisma schema. Walks through migration safely."
---

# Prisma Schema Update Workflow

## When to use
- User says "thêm field/model/relation vào Prisma"
- User says "đổi tên column"
- User says "thêm index"

## Steps
1. Read current `prisma/schema.prisma`
2. Make the change requested
3. Generate migration: `npx prisma migrate dev --name <descriptive_name>`
4. NEVER use `prisma db push` (skips migrations — dangerous in real teams)
5. After migration, regenerate client: `npx prisma generate`
6. Verify by running `npx prisma studio` if user wants visual check

## Naming conventions
- Models: PascalCase singular (User, Post, not Users)
- Fields: camelCase (createdAt, not created_at)
- Migrations: snake_case descriptive (add_user_bio, not migration_1)

## Constraints
- Never edit existing migration files in `prisma/migrations/`
- If schema change is destructive (drop column with data), warn user first
```

### 3.5 Khi nào dùng skill vs prompt

| Tình huống | Cách |
|---|---|
| Task 1 lần | Prompt thẳng |
| Task lặp lại 2-3 lần | Project instructions |
| Task lặp lại với quy trình phức tạp | Skill |
| Cần chạy code deterministic (parse, validate) | Skill có bundle script |

> Anthropic có repo skills mẫu: https://github.com/anthropics/skills
> Docs: https://docs.claude.com/en/docs/claude-code/skills

---

## Phần 4 — MCP: cho Claude truy cập tools/data ngoài

### 4.1 MCP là gì

**Model Context Protocol** là **chuẩn mở** Anthropic ra mắt cuối 2024. Trước MCP, mỗi lần muốn Claude truy cập một service (Slack, GitHub, Postgres) phải code custom. MCP giải quyết bằng cách định nghĩa giao thức chuẩn — viết MCP server 1 lần, bất kỳ AI client nào hỗ trợ MCP đều dùng được (Claude, Cursor, Zed, ...).

Ví von: MCP là **cổng USB-C cho AI**. Trước đó mỗi tool một loại dây.

### 4.2 Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│  Host           │                    │  MCP Server     │
│  (Claude.ai,    │   MCP Protocol     │  (your tool)    │
│  Claude Desktop,│ ◄────────────────► │                 │
│  Claude Code,   │                    │  Exposes:       │
│  Cursor, ...)   │                    │  - tools        │
│                 │                    │  - resources    │
│                 │                    │  - prompts      │
└─────────────────┘                    └─────────────────┘
```

- **Host**: app chứa Claude (Claude Desktop, Claude Code, ...)
- **MCP Server**: process chạy riêng, expose capabilities
- **3 loại "primitives"**:
  - **Tools**: actions Claude có thể gọi (`send_email`, `query_db`)
  - **Resources**: data Claude có thể đọc (`@gmail/inbox`, `@notion/page-123`)
  - **Prompts**: templates user có thể trigger ("/review-pr")

### 4.3 Sử dụng MCP có sẵn (cách dễ nhất)

**Trên Claude.ai web**:
- Settings → Connectors → bật những cái cần (Gmail, Notion, Slack, GitHub, Linear, ...)
- Sau đó hỏi tự nhiên: "Check Gmail có email mới từ boss không"

**Trên Claude Desktop**:
1. Tạo file config: `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) hoặc `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
2. Cấu trúc:
   ```json
   {
     "mcpServers": {
       "filesystem": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/me/Documents"]
       },
       "github": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-github"],
         "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..." }
       }
     }
   }
   ```
3. Restart Claude Desktop. Icon hammer 🔨 xuất hiện ở góc dưới = MCP đã load.

**Trên Claude Code**:
```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```

### 4.4 MCP servers phổ biến

Pre-built: Filesystem, GitHub, GitLab, Postgres, SQLite, Slack, Google Drive, Puppeteer (browser automation), Brave Search, ...

Repository chính thức: https://github.com/modelcontextprotocol/servers

Registry: https://github.com/modelcontextprotocol/registry

### 4.5 Build MCP server riêng

Dùng MCP SDK (Python, TypeScript). Một server đơn giản trong TypeScript:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({ name: "my-mcp", version: "0.1.0" }, {
  capabilities: { tools: {} }
});

server.setRequestHandler("tools/list", async () => ({
  tools: [{
    name: "get_weather",
    description: "Lấy thời tiết hiện tại",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"]
    }
  }]
}));

server.setRequestHandler("tools/call", async (req) => {
  if (req.params.name === "get_weather") {
    const { city } = req.params.arguments;
    // gọi API thời tiết...
    return { content: [{ type: "text", text: `Thời tiết ${city}: 28°C, nắng` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 4.6 Cẩn trọng khi dùng MCP

- **Tốn context**: mỗi server thêm tool descriptions vào context. 7 servers × 10 tools = ~3000 tokens chỉ để Claude biết tools tồn tại. Chỉ bật cái cần.
- **Security**: MCP server có thể access file/network. Không cài server không tin cậy. Dùng read-only credentials nếu được.
- **Tool descriptions phải rõ**: nếu Claude không gọi tool dù bạn nghĩ nên gọi → description chưa rõ "khi nào dùng".

> Docs: https://modelcontextprotocol.io
> Course Anthropic miễn phí: https://anthropic.skilljar.com/introduction-to-model-context-protocol

---

## Phần 5 — Subagents: phân chia công việc trong Claude Code

### 5.1 Subagent là gì

**Tính năng của Claude Code** (không phải Claude.ai). Một subagent là một Claude instance riêng:
- **Context window độc lập** — không thấy main conversation
- **System prompt riêng** — chuyên biệt
- **Tool access riêng** — có thể giới hạn (ví dụ: read-only)
- **Có thể chạy model khác** — ví dụ subagent đơn giản dùng Haiku cho rẻ

Kết quả trả về main conversation chỉ là **summary** của subagent — không phải toàn bộ context nó dùng.

**Vì sao cần?** Hai lợi ích chính:

1. **Context isolation**: search 100 files để tìm bug? Để main conversation đọc 100 files = context đầy ngay. Subagent đọc, summarize "bug ở file X dòng Y" → main conversation chỉ nhận 1 dòng.

2. **Specialization**: subagent code-reviewer có system prompt riêng, biết style guide của bạn, focus vào quality. Subagent test-runner chỉ chạy test, không tự sửa code.

### 5.2 Built-in subagents trong Claude Code

Claude Code có sẵn 5 subagents tự động dùng:

| Subagent | Vai trò |
|---|---|
| **Explore** | Search/đọc codebase. Read-only. Chạy Haiku → nhanh, rẻ |
| **Plan** | Lên kế hoạch (khi gõ `/plan`). Read-only |
| **General-purpose** | Task phức tạp, cần cả search + modify |
| **Claude Code Guide** | Trả lời câu hỏi về Claude Code |
| **statusline-setup** | Helper config terminal |

Bạn không cần làm gì — Claude Code tự gọi khi phù hợp.

### 5.3 Custom subagents

Tạo file markdown trong `.claude/agents/<name>.md` (project-level) hoặc `~/.claude/agents/<name>.md` (global):

```markdown
---
name: prisma-reviewer
description: "MUST BE USED khi review thay đổi Prisma schema. Kiểm tra naming, indexes, relations."
tools: Read, Grep
model: sonnet
---

You are a Prisma schema reviewer. Khi được gọi:

1. Đọc schema.prisma được chỉ định
2. Kiểm tra:
   - Models PascalCase singular
   - Fields camelCase
   - Mọi foreign key có index
   - onDelete đã được set khi cần
   - Field không cần thiết tránh dùng @db.Text
3. Trả về:
   - ✅ Những gì OK
   - ⚠️ Cảnh báo
   - ❌ Lỗi cần sửa
   
Honest, critical, không khen suông.
```

Hoặc tạo bằng `/agents` command trong Claude Code (interactive).

### 5.4 Khi nào nên dùng subagents

**NÊN dùng:**
- Task search/explore trong codebase lớn
- Bạn lặp đi lặp lại cùng 1 loại task (review code, gen test, write docs) → tạo subagent chuyên biệt
- Cần parallel work (nhiều subagents cùng lúc)
- Muốn isolate "messy" tasks (debug, log analysis) khỏi main conversation

**KHÔNG nên dùng:**
- Task đơn giản 1-2 step
- Task cần context của main conversation (subagent KHÔNG thấy lịch sử)
- Bạn vừa mới bắt đầu — học flow chính trước

### 5.5 Skills vs Subagents — phân biệt

| | Skill | Subagent |
|---|---|---|
| Cài ở đâu | Claude.ai, Code, API | Claude Code only |
| Context | Load vào main context | Tách context riêng |
| Khi nào load | Khi task trigger description | Khi main agent quyết định delegate |
| Chia sẻ context | Có | Không |
| Dùng cho | Hướng dẫn/workflow + scripts | Phân chia lao động + cô lập context |

Hai cái có thể dùng cùng nhau: subagent có thể dùng skills.

> Docs: https://docs.claude.com/en/docs/claude-code/sub-agents
> Course: https://anthropic.skilljar.com/introduction-to-subagents
> 100+ subagent samples: https://github.com/VoltAgent/awesome-claude-code-subagents

---

## Phần 6 — CLAUDE.md: bộ nhớ project cho Claude Code

### 6.1 CLAUDE.md là gì

File markdown đặc biệt mà **Claude Code tự đọc ở đầu mỗi session** trong project đó. Coi như "hiến pháp" của project — rules Claude phải tuân theo trong mọi conversation, mọi subagent, mọi lần bạn chạy `claude` trong folder này.

**Khác README.md:**
- README.md → viết cho **người** (dev mới, contributor) — explain HOW
- CLAUDE.md → viết cho **Claude** — rules ngắn gọn, actionable, WHAT TO DO / NOT DO

### 6.2 Hệ thống cấp bậc (loaded theo thứ tự, specific override general)

```
1. ~/.claude/CLAUDE.md                ← user-level (cá nhân, mọi project)
2. <project>/CLAUDE.md                ← project root (commit vào git, share team)
3. <project>/<subdir>/CLAUDE.md       ← subdirectory (load khi work trong subdir)
4. <project>/CLAUDE.local.md          ← personal override cho project này (gitignore)
5. Managed policy CLAUDE.md           ← org-wide (admin set, không bypass được)
```

Tất cả **cộng dồn** — không thay thế nhau. Specific level override general khi conflict.

**Trường hợp thực tế (dự án social media):**
- Root `social-media/CLAUDE.md` — convention chung (TypeScript everywhere, Vietnamese comments)
- `backend/CLAUDE.md` — rules Prisma, lệnh npm, patterns service/route
- `frontend/CLAUDE.md` — Tailwind rules, Zustand patterns

Khi Claude vào folder `backend/` để code, nó tự load cả root + backend CLAUDE.md.

### 6.3 Nội dung nên có trong CLAUDE.md

✅ **NÊN bỏ vào:**
- Build/test/lint commands (`npm run dev`, `npx prisma migrate dev`)
- Tech stack đã chốt
- Naming conventions (kebab-case, PascalCase, ...)
- "Always do X" / "Never do Y" rules
- Project structure (nhanh, link tới README cho chi tiết)
- Anti-patterns cụ thể của project
- Tool quirks (vd: "Prisma migration tên phải snake_case")
- Endpoints / API contracts hiện có

❌ **KHÔNG nên bỏ vào:**
- Generic best practices Claude đã biết ("write clean code", "comment well")
- Thứ Claude có thể tự khám phá khi đọc codebase (Claude sẽ tự nhớ qua auto-memory)
- Documentation dài cho người — đó là job của README
- Bí mật (API keys, passwords) — KHÔNG BAO GIỜ
- Rule thay đổi liên tục — sẽ outdate nhanh

### 6.4 Quy tắc 150-200 instructions

Mô hình AI tuân thủ tin cậy được ~150-200 distinct instructions trong context. Claude Code's system prompt đã chiếm ~50 slots. **Đừng waste lines vào platitudes.**

> CLAUDE.md mô tả architecture bạn đã migrate khỏi 18 tháng trước **tệ hơn không có CLAUDE.md**. Outdated context = guidance sai mỗi lần. Prune định kỳ là maintenance bắt buộc.

### 6.5 Auto-memory (Claude Code v2.1.59+)

Claude Code mới có thêm tính năng **auto-memory**: Claude tự ghi chú learnings ra `~/.claude/projects/<project>/memory/` qua nhiều session. Bạn không cần viết — Claude tự lưu khi thấy info đáng nhớ (build command, naming pattern, gotcha).

**Hệ quả:** CLAUDE.md chỉ cần chứa cái **bạn biết Claude SẼ KHÔNG tự khám phá** (rules nghiêm cấm, decision cố ý). Cái Claude có thể tự học → để auto-memory.

Lệnh `/memory` trong session để xem Claude đã nhớ gì.

### 6.6 CLAUDE.md skeleton (copy được)

```markdown
# [Project Name] — Project Memory

## Project identity
[1-2 câu mô tả: làm gì, cho ai, stage nào]

## Tech stack (immutable)
- [list cụ thể, có version nếu quan trọng]

## Lệnh hay dùng
```
npm run dev
npx prisma migrate dev
docker compose up -d
```

## Conventions
- Naming: ...
- Code organization: ...
- Git workflow: ...

## Anti-patterns — KHÔNG làm
- ❌ ...
- ❌ ...

## Ngữ cảnh sâu hơn
Xem `README.md`, `ARCHITECTURE.md` cho chi tiết.
```

### 6.7 Common mistakes

1. **Viết CLAUDE.md như README** — dài dòng, prose-style. Claude follow rule cụ thể tốt hơn paragraph văn vẻ.
2. **Quên prune** — feature đã bỏ, stack đã đổi mà CLAUDE.md vẫn đề cập.
3. **Không có ở subfolder** — monorepo mà chỉ có 1 CLAUDE.md root → context quá rộng.
4. **Trùng auto-memory** — viết lại thứ Claude đã tự nhớ.
5. **Không commit** — đáng lẽ share team, mà để mỗi người 1 phiên bản → không nhất quán.

### 6.8 CLAUDE.md vs Skills vs Subagents — phân biệt

| | CLAUDE.md | Skills | Subagents |
|---|---|---|---|
| Phạm vi | Tự động mọi session trong folder | Trigger theo task description | Khi main agent quyết delegate |
| Format | Markdown rules | Folder + SKILL.md + scripts | Markdown với YAML frontmatter |
| Context | Load vào main context | Load on-demand | Tách context riêng |
| Tốt cho | Project rules, conventions | Workflow lặp lại, có thể bundle code | Phân chia lao động, task isolation |
| Available ở | Claude Code | Claude.ai, Code, API | Claude Code, API SDK |

3 cái dùng được cùng nhau. Ví dụ: CLAUDE.md set conventions chung → subagent "prisma-reviewer" inherit rules → khi review schema dùng skill "prisma-schema-update" với scripts.

> Docs chính thức: https://docs.claude.com/en/docs/claude-code/memory

---

## Phần 7 — Prompt engineering: 7 nguyên tắc dùng được ngay

### 6.1 Cụ thể đến mức KHÓ HIỂU SAI

❌ "Sửa cho nó đẹp hơn"
✅ "Giảm padding của PostCard từ 24px xuống 16px, đổi màu accent từ đỏ sang xanh dương #2563EB, giữ font Fraunces"

### 6.2 Cho ví dụ đầu vào / đầu ra (few-shot)

```
Convert tên file sang PascalCase:
- user-profile.tsx → UserProfile.tsx
- new-post-modal.tsx → NewPostModal.tsx
- comment-tree.tsx → ?
```

Claude thấy pattern → output đúng format.

### 6.3 Dùng XML tags cho structure phức tạp

```
<task>Refactor function dưới đây</task>

<requirements>
- Đổi sang TypeScript
- Thêm error handling
- Giữ nguyên signature
</requirements>

<code>
function doStuff(x) { ... }
</code>
```

Claude parse XML tốt hơn markdown khi prompt phức tạp.

### 6.4 "Think step by step" / Chain of thought

Với task suy luận phức tạp:
- "Trước khi viết code, hãy phân tích: input là gì, output mong muốn, edge cases."

Hoặc dùng feature `extended thinking` của Claude — model "nghĩ" trước khi trả lời.

### 6.5 Gán role rõ ràng

❌ "Review code này"
✅ "Bạn là senior backend engineer review code junior. Tập trung vào: security, performance, maintainability. Honest, không khen suông."

### 6.6 Negative examples — chỉ ra gì KHÔNG muốn

"Tạo landing page B2B SaaS. KHÔNG dùng: gradient tím-xanh, font Inter, từ 'revolutionary' hoặc 'cutting-edge', icon emoji."

### 6.7 Iterate, đừng kỳ vọng one-shot

Đặc biệt với UI/design: prompt 1 ra phiên bản v0.1. Bạn xem, feedback cụ thể. Prompt 2 ra v0.2. Lặp 3-5 lần. Đó là quy trình bình thường, không phải prompt "kém".

---

## Phần 8 — Workflows thực tế

### Khi build dự án (như social media này)

| Tình huống | Tool tốt nhất |
|---|---|
| Lên kế hoạch, design, thảo luận | Claude.ai (web) |
| Code thực tế trong project | Claude Code (CLI trong folder project) |
| Connect Postgres để Claude query DB | Claude Code + MCP postgres server |
| Review PR, tạo test, gen docs lặp đi lặp lại | Claude Code + custom subagents |
| Quy ước project (commit format, schema rules) | Skills + Project instructions |
| Build feature có AI vào sản phẩm | Claude API |

### Workflow đề xuất cho dự án social media

```
1. Plan ở Claude.ai      → tạo ARCHITECTURE.md
2. Switch sang Claude Code in folder
3. Tạo .claude/agents/ với:
   - prisma-reviewer       (review schema changes)
   - api-tester            (gen curl tests)
   - migration-helper      (đẹp hơn câu lệnh prisma)
4. Tạo .claude/skills/ với:
   - commit-style          (Conventional Commits)
   - vietnamese-comments   (force comment tiếng Việt)
5. MCP postgres server → Claude tự query DB khi debug
6. MCP github server → Claude tạo PR, review issues
```

### Anti-patterns hay thấy

❌ **Hỏi Claude một thứ rồi phản bác mỗi câu trả lời.** Claude không thiên vị — bạn đang dạy nó "đáp án bạn muốn". Tốt hơn: prompt rõ tiêu chí, để Claude tự reason.

❌ **Paste cả file 5000 dòng + "fix bug giúp tôi".** Reduce context: "Bug ở function X, line 200-250. Toàn file đính kèm để tham khảo."

❌ **Cho Claude full quyền mà không kiểm tra.** Đặc biệt với MCP/Code — luôn review trước khi run command nguy hiểm.

❌ **Dùng Claude.ai cho mọi thứ.** Code project? Claude Code tốt hơn. Connect tools? MCP. Long codebase? Subagents.

---

## Phần 9 — Tài liệu official đáng đọc

**Bắt buộc đọc nếu serious về Claude:**
- Anthropic Cookbook: https://github.com/anthropics/anthropic-cookbook (hands-on examples)
- Prompt Engineering Guide: https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview
- Building Effective Agents (post chính thức): https://www.anthropic.com/research/building-effective-agents

**Reference docs:**
- Claude API: https://docs.claude.com
- Claude Code: https://docs.claude.com/en/docs/claude-code/overview
- Skills: https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview
- MCP: https://modelcontextprotocol.io
- Subagents: https://docs.claude.com/en/docs/claude-code/sub-agents

**Courses miễn phí (Anthropic Academy):**
- https://anthropic.skilljar.com — có courses về prompt engineering, MCP, subagents, tool use

**Cộng đồng:**
- Anthropic Discord: link trong docs
- r/ClaudeAI subreddit
- GitHub anthropics/skills, modelcontextprotocol/servers

---

## Phần 10 — Lộ trình học gợi ý cho bạn

Cho người mới như bạn (đang build social media + học AI engineering):

**Tuần 1-2: Foundations**
- Đọc xong tài liệu này
- Quen với Claude.ai: project, instructions, artifacts
- Hoàn thành Phase 1 backend (đã có)
- Đọc prompt engineering docs

**Tuần 3-4: Claude Code**
- Cài Claude Code, dùng cho phase 2 của project (posts core)
- Tạo 1-2 custom skill cho project (commit style, naming)
- Quen với plan mode (`/plan`), explore agent

**Tuần 5-6: MCP**
- Cài Claude Desktop + filesystem MCP
- Cài Postgres MCP cho project — Claude query DB trực tiếp
- Đọc MCP course Anthropic

**Tuần 7-8: Subagents**
- Tạo 2-3 custom subagents (reviewer, test-gen, doc-gen)
- Học khi nào delegate, khi nào không
- Đọc subagents course

**Tuần 9+: Build with API**
- Khi project social media tới phase tích hợp AI features (auto caption, content moderation)
- Học function calling, structured outputs, tool use

---

## Closing thought

Quan trọng nhất khi làm AI engineer với Claude **không phải** memo hết features. Là biết:

1. **Khi nào** dùng feature gì — context isolation cần subagent, workflow lặp lại cần skill, data ngoài cần MCP
2. **Cách shape behavior** qua context — vì bạn không fine-tune model, mọi thứ là prompt + skills + system + tools
3. **Iterate & verify** — Claude sai thường xuyên, đặc biệt với task phức tạp. Một engineer giỏi không tin Claude mù quáng

Mọi thứ khác chỉ là tool. Mental model đúng → chọn tool đúng → ra kết quả tốt.
