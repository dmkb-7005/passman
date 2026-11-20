# Design briefs and canvases

The briefs (with the design decisions taken on each canvas) are kept in the claude.ai project "PassMan" under `claude/design/`. The canvases are Claude Design artifacts.

| # | Screen group | Canvas | Status |
|---|---|---|---|
| 01 | Welcome and Create vault | [PassMan · Welcome and Create vault](https://claude.ai/artifact/VmAQTtrekn8q4tMHmHTtyo) | implemented in v0.3.0 (Dropbox / restore: next milestones) |
| 02 | Unlock and Recover | [PassMan · Unlock and Recover](https://claude.ai/artifact/Fb4RpuLnzmLEJrFcfiAHAK) | implemented in v0.3.0 |
| 03 | Logins (tab) | [PassMan · Logins](https://claude.ai/artifact/M8yrFf9EURhR8DHWTMcXWB) | implemented in v0.3.0 (sync chip shows "Not synced" until sync exists) |
| 04 | Login detail | [PassMan · Login detail](https://claude.ai/artifact/U1ZuYe6XvADWACAwidfw7T) | implemented in v0.3.0 |
| 05 | Add / Edit login | [PassMan · Add / Edit login](https://claude.ai/artifact/GSbjviwtZ185aQnVitUmDR) | implemented in v0.3.0 |
| 06 | Generator (tab) | [PassMan · Generator](https://claude.ai/artifact/KhowHk3hSUDbH1jDfvtqyJ) | implemented in v0.3.0 |
| 07 | Settings | [PassMan · Settings](https://claude.ai/artifact/TcrcdV3S6XdwPPZ4DEirW6) | implemented in v0.3.0 (Sync, Backup, Import: next milestones) |

Small deviations from the canvases, by design:
- Change master password: a wrong current password turns the info note into an error note (the canvas has no error slot there, and a new slot would move the fields).
- Unlock after "Lock now" shows no status line (the canvas only defines idle and background reasons).
