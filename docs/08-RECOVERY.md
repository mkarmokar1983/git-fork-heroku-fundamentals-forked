# 08 — Git Rollback & Recovery

> **Phase 8 of 8** | Undo mistakes safely — uncommitted changes, bad commits, deleted branches, broken merges, and accidental pushes.

---

## Table of Contents

1. [The Safety Mindset](#1-the-safety-mindset)
2. [Undo Uncommitted Changes](#2-undo-uncommitted-changes)
3. [Amend the Last Commit](#3-amend-the-last-commit)
4. [git reset](#4-git-reset)
5. [git revert](#5-git-revert)
6. [reset vs revert — Decision Table](#6-reset-vs-revert--decision-table)
7. [git reflog](#7-git-reflog)
8. [Recover a Deleted Branch](#8-recover-a-deleted-branch)
9. [Undo a Merge](#9-undo-a-merge)
10. [Undo a git push](#10-undo-a-git-push)
11. [Quick Reference Cheatsheet](#11-quick-reference-cheatsheet)

---

## 1. The Safety Mindset

Before reaching for any undo command, ask two questions:

| Question | Answer → Tool |
|---|---|
| Has the commit been pushed? | **No** → `reset`, `amend`, `restore` are all safe |
| Has the commit been pushed? | **Yes** → use `revert`; avoid `reset` on shared history |

**Golden rule:** Never rewrite history on a branch others are using.

```
Working Directory
      |
      | git add
      v
  Staging Area (Index)
      |
      | git commit
      v
  Local Repository
      |
      | git push
      v
  Remote (GitHub / Heroku)
```

Each layer has its own undo tool — match the tool to the layer.

---

## 2. Undo Uncommitted Changes

These commands only touch your **working directory** or **staging area** — no commits involved.

### Discard changes in working directory

```bash
# Discard all changes to a specific file (restore from last commit)
git restore <file>

# Discard ALL unstaged changes in the entire repo
git restore .
```

> `git restore` is the modern replacement for `git checkout -- <file>` (Git 2.23+).

### Unstage a file (keep the changes, just remove from staging)

```bash
git restore --staged <file>

# Unstage everything
git restore --staged .
```

### Remove untracked files

```bash
# Preview what will be deleted (dry run — always do this first)
git clean -n

# Delete untracked files
git clean -f

# Delete untracked files AND untracked directories
git clean -fd
```

> `git clean` is **permanent** — files removed this way are not in Git history and cannot be recovered.

---

## 3. Amend the Last Commit

Use `--amend` when the commit has **not been pushed** yet.

### Fix the commit message only

```bash
git commit --amend -m "Correct commit message here"
```

### Add a forgotten file to the last commit

```bash
git add forgotten-file.txt
git commit --amend --no-edit     # keeps the existing message
```

### What amend actually does

`--amend` replaces the last commit with a brand-new commit (different SHA). The old commit is discarded from the branch tip.

```
Before:  A -- B (HEAD)
After:   A -- B' (HEAD)   ← new SHA, B is gone from branch
```

> If you already pushed the commit, amend + force-push will cause problems for anyone who pulled. Use `git revert` instead.

---

## 4. git reset

`git reset` moves the branch pointer backward to an earlier commit. It has three modes that control what happens to your files.

### The three modes

```
Commit:       A -- B -- C (HEAD)
                         |
                    want to undo C
```

| Mode | Command | Keeps files in working dir? | Keeps files staged? |
|---|---|---|---|
| `--soft` | `git reset --soft HEAD~1` | Yes | Yes (staged) |
| `--mixed` | `git reset HEAD~1` | Yes | No (unstaged) |
| `--hard` | `git reset --hard HEAD~1` | No (deleted) | No |

### Visual diagram

```
--soft:   A -- B  (HEAD)   working dir = C's changes (staged)
--mixed:  A -- B  (HEAD)   working dir = C's changes (unstaged)
--hard:   A -- B  (HEAD)   working dir = clean (C's changes GONE)
```

### Common use cases

```bash
# Undo last commit, keep changes staged (ready to re-commit)
git reset --soft HEAD~1

# Undo last commit, keep changes but unstaged (inspect before re-committing)
git reset HEAD~1

# Undo last 3 commits completely (destructive — local only)
git reset --hard HEAD~3

# Reset to a specific commit by SHA
git reset --hard a1b2c3d
```

### Reset a single file to its state at HEAD

```bash
git reset HEAD <file>          # unstage the file
git restore <file>             # then discard working dir changes
```

> `git reset` on **pushed** commits rewrites history. Only use on local-only commits.

---

## 5. git revert

`git revert` creates a **new commit** that undoes the changes of a previous commit. History is never rewritten — safe for shared branches.

### Revert the last commit

```bash
git revert HEAD
```

Git opens your editor to write a commit message (default is fine). Save and close.

### Revert a specific commit

```bash
# Find the SHA first
git log --oneline

# Revert that commit
git revert a1b2c3d
```

### Revert without opening the editor

```bash
git revert HEAD --no-edit
```

### Revert multiple commits

```bash
# Revert a range (oldest first in the range notation)
git revert HEAD~3..HEAD --no-edit
```

### What revert looks like in history

```
Before:  A -- B -- C  (the bad commit)
After:   A -- B -- C -- C'  (C' undoes C's changes)
```

The code returns to what it was before C, but C and C' both remain in history.

---

## 6. reset vs revert — Decision Table

| Scenario | Use |
|---|---|
| Commit not pushed yet, want it gone completely | `git reset --hard` |
| Commit not pushed, want to redo it | `git reset --soft` or `--mixed` |
| Commit already pushed to a shared branch | `git revert` |
| Need to undo changes but preserve audit trail | `git revert` |
| Working on a private feature branch (you are the only user) | Either is fine |
| `main` branch with teammates | Always `git revert` |

**Simple rule:** pushed = revert, local-only = reset.

---

## 7. git reflog

`git reflog` is a local log of everywhere your `HEAD` has pointed. It is your **ultimate safety net** — it records every reset, checkout, merge, and rebase, even ones that removed commits from branch history.

```bash
# View the reflog
git reflog
```

Example output:

```
a1b2c3d HEAD@{0}: reset: moving to HEAD~1
f4e5d6c HEAD@{1}: commit: add login feature
9g8h7i6 HEAD@{2}: commit: initial setup
```

### Restore a commit that was "lost" by reset

```bash
# Find the SHA of the commit you want back
git reflog

# Create a new branch at that commit
git checkout -b recovery-branch f4e5d6c

# Or reset your current branch forward to it
git reset --hard f4e5d6c
```

### Reflog expiry

Reflog entries expire after **90 days** by default. Within that window, almost nothing is truly lost.

---

## 8. Recover a Deleted Branch

If you deleted a branch with `git branch -d` or `-D`, the commits still exist in reflog.

### Step-by-step recovery

```bash
# Step 1 — Find the last commit that was on the deleted branch
git reflog

# Look for a line like:
# a1b2c3d HEAD@{4}: checkout: moving from feature/login to main

# Step 2 — Recreate the branch at that commit
git checkout -b feature/login a1b2c3d
```

### Alternative: search reflog by message

```bash
git log --all --oneline | grep "feature description"
```

### Recovery from remote (if it was pushed)

```bash
# The remote still has it — just re-checkout
git fetch origin
git checkout -b feature/login origin/feature/login
```

---

## 9. Undo a Merge

### Before the merge is pushed

```bash
# Option A — Reset to the commit before the merge
git reset --hard HEAD~1

# Option B — Use ORIG_HEAD (Git saves it automatically before a merge)
git reset --hard ORIG_HEAD
```

`ORIG_HEAD` is set by Git right before any operation that moves HEAD significantly (merge, rebase, reset). It is the safest way to undo a merge immediately after it happens.

### After the merge is pushed

Use `git revert` with the `-m` flag to specify which parent to keep:

```bash
# Find the merge commit SHA
git log --oneline

# Revert it (1 = the main branch parent, 2 = the merged-in branch parent)
git revert -m 1 <merge-commit-sha>
git push
```

> `-m 1` means "treat parent #1 (the branch you merged INTO) as the mainline."

---

## 10. Undo a git push

Once a commit is on a remote, other people may have already pulled it. Options from safest to most destructive:

### Option A — git revert (recommended for shared branches)

```bash
git revert HEAD --no-edit
git push
```

Creates a new commit that undoes the pushed commit. History stays intact. Safe for `main`.

### Option B — Force push (only for your own private branch)

```bash
# Reset locally first
git reset --hard HEAD~1

# Then force push
git push --force-with-lease origin feature/my-branch
```

`--force-with-lease` is safer than `--force` — it fails if someone else pushed to the branch since your last fetch, preventing you from overwriting their work.

> **Never force-push to `main`, `develop`, or any shared branch.**

### What force push does

```
Remote before:  A -- B -- C
Local after reset: A -- B
Force push result: A -- B    (C is gone from remote — anyone who pulled C is now diverged)
```

---

## 11. Quick Reference Cheatsheet

### Undo by situation

| Situation | Command |
|---|---|
| Discard unsaved file changes | `git restore <file>` |
| Unstage a file | `git restore --staged <file>` |
| Remove untracked files | `git clean -fd` |
| Fix last commit message | `git commit --amend -m "new message"` |
| Add file to last commit | `git add <file>` then `git commit --amend --no-edit` |
| Undo last commit, keep changes staged | `git reset --soft HEAD~1` |
| Undo last commit, keep changes unstaged | `git reset HEAD~1` |
| Undo last commit, discard changes | `git reset --hard HEAD~1` |
| Undo a pushed commit safely | `git revert HEAD --no-edit` |
| Undo a merge (before push) | `git reset --hard ORIG_HEAD` |
| Undo a merge (after push) | `git revert -m 1 <merge-sha>` |
| Recover a "lost" commit | `git reflog` then `git checkout -b recovery <sha>` |
| Recover a deleted branch | `git reflog` → find SHA → `git checkout -b <name> <sha>` |

### reset modes at a glance

```
git reset --soft HEAD~1   →  undo commit, keep changes STAGED
git reset HEAD~1           →  undo commit, keep changes UNSTAGED
git reset --hard HEAD~1   →  undo commit, DELETE changes
```

### The undo ladder

```
Problem layer          Tool
--------------         ----
Working directory   →  git restore <file>
Staging area        →  git restore --staged <file>
Last local commit   →  git reset / git commit --amend
Older local commit  →  git reset --hard <sha>
Pushed commit       →  git revert <sha>
Lost anything       →  git reflog
```

---

**Next:** [01 — Setup & Account →](./01-SETUP.md) *(back to the beginning)*

---

## 🧑‍💻 Author

*Md. Sarowar Alam*  
Lead DevOps Engineer, Hogarth Worldwide  
📧 Email: sarowar@hotmail.com  
🔗 LinkedIn: https://www.linkedin.com/in/sarowar/

---
