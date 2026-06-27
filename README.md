# Codex PM

**Codex PM** is an open-source, Codex-native project manager plugin.

> Docs in. Verified progress out.

It turns `docs/` Markdown project documents into **verified Codex development progress**.

## Product Positioning

Codex PM is not another AI task manager. It is a **cerebellum-style project manager layer for Codex**.

- **Codex** is the LLM brain and engineer.
- **Codex PM** is the project manager cerebellum.
- **`docs/`** is the project contract.
- **Tests, lint, build, and diff checks** are the verification authority.

---

## Quick Start

### Prerequisites

- Node.js 18+ with npm
- [Codex CLI](https://github.com/codex-project/codex) installed and configured
- Git (for version control)

### Installation

```bash
# Clone the repository
git clone https://github.com/MaxYang-1006/codex-pm.git
cd codex-pm

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### First Start

```bash
# Run diagnostics to check your environment
codex-pm doctor

# Scan your project docs
codex-pm scan

# Check project status
codex-pm status

# See recommended next task
codex-pm next

# Try a dry-run first
codex-pm run-one --dry-run
```

---

## Docs-First Workflow

Codex PM follows a **docs-first** approach where your project documentation is the source of truth.

### 1. Create Project Documents

Place Markdown documents in the `docs/` directory:

```
docs/
├── 00_PRODUCT_BRIEF.md    # Product vision and goals
├── 01_PRD.md              # Product requirements
├── 03_SYSTEM_ARCHITECTURE.md  # Technical architecture
├── 05_EVOLUTION_EXPERIMENT_SPEC.md  # Evolution experiment
├── 06_MEMORY_SYSTEM_SPEC.md  # Memory system
├── 07_TASK_AND_DOCS_SPEC.md  # Task format
├── 08_CLI_COMMAND_SPEC.md  # CLI commands
├── 09_PROMPT_TEMPLATES.md  # Prompt templates
├── 10_DATA_SCHEMAS.md     # Data schemas
├── 11_TASKS.md            # Task definitions
├── 13_TESTING_AND_ACCEPTANCE.md  # Testing guide
├── 14_OPEN_SOURCE_STRATEGY.md  # Open source strategy
├── 15_ROADMAP.md          # Roadmap
├── FAQ.md                 # FAQ
└── TUTORIAL.md           # Tutorial
```

### 2. Define Tasks in TASKS.md

Tasks are defined using a specific format in `docs/TASKS.md`:

```markdown
### P1-T001: Example Task

Status: pending
Priority: 5
Risk: low
Size: M
Area: core
Depends on: P0-T001
Human approval: no

Description:
This is the task description.

Acceptance:
- First acceptance criterion
- Second acceptance criterion

Verify:
- npm run build
- npm test
```

### 3. Codex PM Manages the Rest

```
codex-pm scan        # Parse docs and build task graph
codex-pm status      # View project status
codex-pm next        # Get next recommended task
codex-pm run-one     # Execute the task with Codex
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `start` | First-run setup: doctor → scan → recommend |
| `doctor` | Check environment and prerequisites |
| `validate-docs` | Validate docs format and completeness |
| `scan` | Scan docs and build task graph |
| `status` | Show project and task status |
| `next` | Recommend next runnable task |
| `run-one` | Run a single task (dry-run by default) |
| `run` | Run multiple tasks with loop control |
| `repair` | Repair failed tasks |
| `review` | Review current diff and task status |
| `fitness` | Show fitness metrics summary |
| `evolve` | Analyze evolution experiment results |
| `genome` | Manage PM strategy profiles |
| `energy` | Manage energy balance |

### Common Usage

```bash
# First-time setup
codex-pm start

# Check environment health
codex-pm doctor

# Validate docs format
codex-pm validate-docs

# Scan project and see status
codex-pm scan
codex-pm status

# Review git diff and task status
codex-pm review

# Get next recommended task (smart or sequential mode)
codex-pm next
codex-pm next --mode sequential

# Run next recommended task (dry-run mode)
codex-pm run-one --dry-run

# Run task for real
codex-pm run-one --task P1-T001

# Run with the default safe sandbox
codex-pm run-one --task P1-T001 --sandbox workspace-write

# Run with loop control (max 5 tasks)
codex-pm run --max-tasks 5

# Run with guided mode
codex-pm run --mode guided --max-tasks 10

# Repair a failed task
codex-pm repair --task P1-T003

# View fitness metrics
codex-pm fitness
codex-pm fitness --task P1-T003

# Analyze evolution experiments
codex-pm evolve --report
codex-pm evolve --list

# Interactive mode (prompt for high-risk task approval)
codex-pm run --interactive --max-tasks 10
codex-pm run-one --task P2-T003 --interactive

# Energy management
codex-pm energy              # Show energy status
codex-pm energy --refill 500 # Add 500 energy
codex-pm energy --reset      # Reset to initial value

# Run with energy refill
codex-pm run --refill-energy 1000 --max-tasks 10
```

---

## Safety Gates

Codex PM implements multiple safety mechanisms to protect your project:

### Risk Classification

| Risk Level | Description | Behavior |
|-------------|-------------|----------|
| `low` | Safe changes (docs, tests) | Auto-approved |
| `medium` | Moderate impact (new features) | Warn before run |
| `high` | Significant changes (refactors) | Approval required |
| `critical` | Dangerous (security, migrations) | Blocked by default |

### Safety Principles

**Allowed automatic adaptation:**
- Task scoring weights
- Risk thresholds within approved ranges
- Memory recall weights
- Retry policy within limits
- Prompt template preference
- Energy budget allocation

**Forbidden automatic adaptation:**
- Disabling sandbox
- Bypassing approval gates
- Deleting audit logs
- Weakening auth/payment/secret/database safety rules
- Production deployment rules
- Destructive file deletion policy

### High-Risk Task Handling

```bash
# High-risk tasks require approval
codex-pm run-one --task P2-T003 --sandbox workspace-write

# View risk assessment
codex-pm status --risk
```

After human review, mark the task as approved in `TASKS.md` with
`Human approval: yes`. Codex PM rejects managed real execution with sandbox
disabled or `danger-full-access`.

### Interactive Approval Mode

For a more streamlined workflow, use interactive mode to approve high-risk tasks
on the fly:

```bash
# Run with interactive approval
codex-pm run --interactive --max-tasks 10

# Output when high-risk task is detected:
# ⚠  HIGH RISK TASK DETECTED
# 
#   Task ID:   P2-T003
#   Title:     Implement authentication
#   Risk:      high (78.5%)
#   Priority:  8
#   Size:      L
# 
#   Risk factors:
#     - base_risk: Task risk field: high
#     - keywords: Matched: auth, password, token
# 
# Approve this high-risk task and continue? [y/N]
```

**Features:**
- ✅ Terminal-based approval prompts
- ✅ Shows task details and risk factors
- ✅ Defaults to NO for safety
- ✅ Falls back to automatic stop in non-TTY environments

---

## Energy System

Codex PM uses an energy system to prevent unlimited task execution:

### Energy Rules

| Rule | Description |
|------|-------------|
| **Initial Energy** | 500 units |
| **Max Energy** | 2000 units |
| **Time Restore** | 50 units per hour |
| **Success Refund** | 30% of task cost (only when verification passes) |

### Energy Cost Calculation

```
estimatedCost = baseCost × riskMultiplier × retryFactor + verificationCost

baseCost: XS=10, S=20, M=40, L=80, XL=160
riskMultiplier: none=0.8, low=1.0, medium=1.2, high=1.5, critical=2.0
```

### Energy Management

```bash
# Check energy status
codex-pm energy
# === Energy Status ===
# Balance: 450 / 2000 units
# Total Earned: 1200 units
# Total Spent: 750 units
# Restore Rate: 50 units/hour
# Success Refund: 30%

# Refill energy manually
codex-pm energy --refill 500
# Energy refilled: +500 units (new balance: 950)

# Reset energy to initial value
codex-pm energy --reset
# Energy reset to 500 units

# Refill when running tasks
codex-pm run --refill-energy 1000 --max-tasks 10
```

### Energy Flow Example

```
Initial: 500 energy

Execute Task T001 (M/low, cost=40)
  Spent: -40 → Balance: 460
  Success + verification passed → Refund: +12 → Balance: 472

Execute Task T002 (L/high, cost=120)
  Spent: -120 → Balance: 352
  Failed → No refund → Balance: 352

Wait 2 hours
  Time restore: +100 → Balance: 452
```

---

## Genome Profiles

Codex PM supports different PM "personalities" called **genome profiles**:

| Profile | Description | Best For |
|---------|-------------|----------|
| `balanced` | Default, balanced approach | General projects |
| `conservative` | Low risk, high verification | Production systems |
| `startup` | Fast MVP delivery | Rapid prototyping |
| `research` | Allows experiments | R&D projects |

### Managing Profiles

```bash
# List available profiles
codex-pm evolve --list

# Analyze a specific profile
codex-pm evolve --report --profile balanced

# Compare profiles
codex-pm evolve --report --compare conservative
```

---

## Evolution Experiments

Codex PM can run **evolution experiments** to optimize PM strategy:

```bash
# Run experiment with specific profile
codex-pm run --profile conservative --max-tasks 10

# Analyze results
codex-pm evolve --report

# View episode logs
codex-pm evolve --report --episodes 20
```

---

## Task Format Reference

### Task Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `Status` | string | Yes | `pending`, `done`, `failed`, `blocked` |
| `Priority` | number | Yes | 1-10, higher = more important |
| `Risk` | string | Yes | `low`, `medium`, `high`, `critical` |
| `Size` | string | Yes | `XS`, `S`, `M`, `L`, `XL` |
| `Area` | string | Yes | Functional area (e.g., `core`, `docs`) |
| `Depends on` | string | No | Task dependencies (e.g., `P0-T001, P0-T002`) |
| `Human approval` | string | Yes | `yes` or `no` |
| `Locked` | string | No | `yes` or `no` |

### Example Task

```markdown
### P1-T003: Implement user authentication

Status: pending
Priority: 8
Risk: high
Size: L
Area: auth
Depends on: P1-T001, P1-T002
Human approval: yes
Locked: no

Description:
Implement JWT-based user authentication with OAuth2 support.

Acceptance:
- Users can register with email/password
- Users can login and receive JWT token
- OAuth2 login with Google works
- Token refresh mechanism implemented

Verify:
- npm run build
- npm test
- npm run lint
```

---

## Configuration

Codex PM stores state in `.codex-pm/` directory:

```
.codex-pm/
├── state.json          # Project state and tasks
├── audit.jsonl         # Execution audit logs
├── episodes.jsonl      # Evolution episode logs
├── scan-report.md      # Scan report
├── energy.json         # Energy balance
├── memory/             # Memory storage
├── results/            # Task execution results
├── reports/            # Loop run reports
└── prompts/           # Generated prompts
```

### Ignoring State Directory

Add to your `.gitignore`:

```gitignore
.codex-pm/
```

---

## Minimal Example

Create a new project with Codex PM:

```bash
# 1. Initialize project
mkdir my-project && cd my-project
git init
npm init

# 2. Create docs directory
mkdir docs

# 3. Create TASKS.md
cat > docs/TASKS.md << 'EOF'
### P0-T001: Initialize project

Status: pending
Priority: 5
Risk: low
Size: S
Area: setup
Depends on: none
Human approval: no

Description:
Initialize the project with basic structure.

Acceptance:
- package.json created
- .gitignore created
- README.md created

Verify:
- ls package.json
- ls .gitignore
EOF

# 4. Scan and run
codex-pm scan
codex-pm next
codex-pm run-one --dry-run
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Codex PM CLI                          │
├─────────────────────────────────────────────────────────────┤
│  Commands: doctor, scan, status, next, run-one, repair...  │
├─────────────────────────────────────────────────────────────┤
│                      Core Modules                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │ Task Parser │  │Task Scorer  │  │ State Manager   │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │Energy Gate  │  │Risk Gate    │  │ Prompt Builder  │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                     Memory System                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │Memory Writer│  │Memory Recall│  │ Fitness Calc    │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                   Execution Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │Codex Executor│ │ Verifier    │  │ Result Writer   │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                      Codex CLI                              │
│                    (External Tool)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Doctor checks failing

```bash
# Check Codex CLI is installed
codex --version

# Check Node.js version
node --version

# Verify working directory
pwd
```

### Tasks not appearing after scan

- Ensure `docs/TASKS.md` exists
- Check task syntax matches the format
- Run `codex-pm doctor` for diagnostics

### High-risk tasks blocked

- Review task risk classification
- After human review, set `Human approval: yes` for approved high-risk tasks
- Consider switching to a more permissive genome profile

---

## License

MIT License - see LICENSE file for details.

---

## Contributing

This project is designed to be developed by Codex itself. See `AGENTS.md` for development guidelines.
