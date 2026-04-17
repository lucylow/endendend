# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-overview-debug.spec.ts >> dashboard overview has no console errors
- Location: e2e/dashboard-overview-debug.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /Swarm overview/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /Swarm overview/i })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - link "Skip to main content" [ref=e4] [cursor=pointer]:
      - /url: "#dashboard-main"
    - complementary [ref=e5]:
      - generic [ref=e6]:
        - link "Tashi Swarm dApp · Control" [ref=e7] [cursor=pointer]:
          - /url: /
          - img [ref=e9]
          - generic [ref=e11]:
            - heading "Tashi Swarm" [level=2] [ref=e12]
            - paragraph [ref=e13]: dApp · Control
        - paragraph [ref=e14]: "On-chain staking + off-chain mesh. Swarm #ALPHA-01 · Vertex + FoxMQ."
      - navigation "Dashboard" [ref=e15]:
        - generic [ref=e16]:
          - paragraph [ref=e17]: Protocol
          - link "Staking & rewards" [ref=e18] [cursor=pointer]:
            - /url: /dashboard/staking
            - img [ref=e19]
            - generic [ref=e21]: Staking & rewards
          - link "Task auctions" [ref=e22] [cursor=pointer]:
            - /url: /dashboard/auctions
            - img [ref=e23]
            - generic [ref=e29]: Task auctions
          - link "Billing" [ref=e30] [cursor=pointer]:
            - /url: /dashboard/billing
            - img [ref=e31]
            - generic [ref=e33]: Billing
        - generic [ref=e34]:
          - paragraph [ref=e35]: Command
          - link "Overview" [ref=e36] [cursor=pointer]:
            - /url: /dashboard
            - img [ref=e37]
            - generic [ref=e42]: Overview
          - link "Live simulation" [ref=e43] [cursor=pointer]:
            - /url: /dashboard/simulation
            - img [ref=e44]
            - generic [ref=e46]: Live simulation
          - link "3D swarm viz" [ref=e47] [cursor=pointer]:
            - /url: /dashboard/swarm
            - img [ref=e48]
            - generic [ref=e51]: 3D swarm viz
          - link "Victim detection" [ref=e52] [cursor=pointer]:
            - /url: /dashboard/victim-detection
            - img [ref=e53]
            - generic [ref=e60]: Victim detection
          - link "Scalability" [ref=e61] [cursor=pointer]:
            - /url: /dashboard/scalability
            - img [ref=e62]
            - generic [ref=e64]: Scalability
          - link "Analytics" [ref=e65] [cursor=pointer]:
            - /url: /dashboard/analytics
            - img [ref=e66]
            - generic [ref=e68]: Analytics
        - generic [ref=e69]:
          - paragraph [ref=e70]: Missions
          - link "Mission replay" [ref=e71] [cursor=pointer]:
            - /url: /dashboard/replay
            - img [ref=e72]
            - generic [ref=e74]: Mission replay
          - link "Scenarios" [ref=e75] [cursor=pointer]:
            - /url: /dashboard/scenarios
            - img [ref=e76]
            - generic [ref=e81]: Scenarios
          - link "SAR master demo" [ref=e82] [cursor=pointer]:
            - /url: /scenarios/search-rescue
            - img [ref=e83]
            - generic [ref=e90]: SAR master demo
          - link "Arena obstacle course" [ref=e91] [cursor=pointer]:
            - /url: /scenarios/arena-obstacle
            - img [ref=e92]
            - generic [ref=e98]: Arena obstacle course
          - link "Multi-swarm handover" [ref=e99] [cursor=pointer]:
            - /url: /scenarios/multi-swarm-handoff
            - img [ref=e100]
            - generic [ref=e104]: Multi-swarm handover
          - link "Thermal rebalance" [ref=e105] [cursor=pointer]:
            - /url: /scenarios/thermal-rebalance
            - img [ref=e106]
            - generic [ref=e108]: Thermal rebalance
          - link "Magnetic attraction" [ref=e109] [cursor=pointer]:
            - /url: /scenarios/magnetic-attraction
            - img [ref=e110]
            - generic [ref=e114]: Magnetic attraction
          - link "Collapsing tunnel" [ref=e115] [cursor=pointer]:
            - /url: /scenarios/collapsing-tunnel
            - img [ref=e116]
            - generic [ref=e118]: Collapsing tunnel
          - link "Predator / forklift evasion" [ref=e119] [cursor=pointer]:
            - /url: /scenarios/predator-evasion
            - img [ref=e120]
            - generic [ref=e122]: Predator / forklift evasion
          - link "Random leader failure" [ref=e123] [cursor=pointer]:
            - /url: /scenarios/random-failure
            - img [ref=e124]
            - generic [ref=e130]: Random leader failure
        - generic [ref=e131]:
          - paragraph [ref=e132]: Fleet
          - link "Agents" [ref=e133] [cursor=pointer]:
            - /url: /dashboard/agents
            - img [ref=e134]
            - generic [ref=e139]: Agents
          - link "Settings" [ref=e140] [cursor=pointer]:
            - /url: /dashboard/settings
            - img [ref=e141]
            - generic [ref=e144]: Settings
      - generic [ref=e145]:
        - link "Documentation" [ref=e146] [cursor=pointer]:
          - /url: /docs
          - img [ref=e147]
          - text: Documentation
        - link "Admin" [ref=e149] [cursor=pointer]:
          - /url: /admin
          - img [ref=e150]
          - text: Admin
    - generic [ref=e153]:
      - generic [ref=e155]:
        - generic [ref=e157]:
          - generic [ref=e158]:
            - img [ref=e161]
            - generic [ref=e163]: Fleet
            - generic [ref=e164]: Healthy
          - generic [ref=e165]: "|"
          - generic [ref=e166]:
            - img [ref=e167]
            - generic [ref=e172]: Agents
            - generic [ref=e173]: 8/8
          - generic [ref=e174]: "|"
          - generic [ref=e175]:
            - img [ref=e176]
            - generic [ref=e178]: Avg battery
            - generic [ref=e179]: 81%
          - generic [ref=e180]: "|"
          - generic [ref=e181]:
            - img [ref=e182]
            - generic [ref=e188]: Mode
            - generic [ref=e189]: Idle
        - button "Connect wallet" [ref=e191] [cursor=pointer]:
          - img
          - generic [ref=e192]: Connect wallet
          - img
      - main [ref=e193]:
        - generic [ref=e195]:
          - text: Failed to load overview.
          - link "Retry" [ref=e196] [cursor=pointer]:
            - /url: /dashboard
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test("dashboard overview has no console errors", async ({ page }) => {
  4  |   const errors: string[] = [];
  5  |   page.on("console", (msg) => {
  6  |     if (msg.type() === "error") errors.push(msg.text());
  7  |   });
  8  |   page.on("pageerror", (err) => {
  9  |     errors.push(err.message);
  10 |   });
  11 |   await page.goto("/dashboard");
  12 |   await expect(page.locator("#dashboard-main")).toBeVisible({ timeout: 30_000 });
> 13 |   await expect(page.getByRole("heading", { name: /Swarm overview/i })).toBeVisible();
     |                                                                        ^ Error: expect(locator).toBeVisible() failed
  14 |   expect(errors, `console/page errors: ${errors.join("\n")}`).toEqual([]);
  15 | });
  16 | 
```