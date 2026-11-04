# SEAQL v8 — "Midnight Aurora" design system

The V8 update changes how the dashboard looks and nothing else. It keeps the V3 layout, all routes, the backend and the ML models exactly as they were.

## Colors

| Role | Token | Hex | Used for |
|---|---|---|---|
| Midnight Navy | `--bg` | `#080E20` | page background |
| Deep Navy | `--bg-3` | `#132341` | cards, table headers |
| Electric Cyan | `--cyan` | `#22D3EE` | main accent, active state, links |
| Royal Purple | `--purple` | `#8B5CF6` | second accent, Cluster B, gradients |
| Accent gradient | `--accent` | `#22D3EE → #6D8BFF → #8B5CF6` | primary buttons, active nav bar, progress bars |
| Soft White | `--text` | `#F5F9FF` | headings, main text |
| Secondary text | `--text-2` / `--text-3` | `#B4C1DA` / `#7C8DB0` | descriptions, labels |
| Emerald | `--green` | `#34D399` (`#10B981` for fills) | healthy / benign / verified |
| Coral Red | `--red` | `#FF5A76` | attacks / critical |
| Amber | `--amber` | `#FBBF24` | warnings / simulation labels |

Cyan and purple are the only two brand accents, and they always appear together as one gradient. Green, red and amber are used only to show status, so they keep their meaning. The previous colors were remapped one to one, so each status and each research-integrity label keeps the same meaning it had in V3.

## What changed visually

- **Background:** a soft cyan and purple aurora with a faint dot-grid texture.
- **Sidebar:** the active page has a soft gradient background with a glowing cyan-to-purple bar on the left. The old solid cyan block is gone. Links slide slightly on hover, and the brand name uses gradient text.
- **Cards:** dark glass cards with a thin cyan-to-purple highlight along the top edge. The highlight and border glow get stronger on hover.
- **KPI cards:** each has a colored top accent line, a corner glow, a soft glow behind the number and a small lift on hover.
- **Home hero:** the SEAQL title has a slowly moving gradient sheen. The drone floats over orbit rings and a glowing network of nodes, with a slow scan line and drifting aurora behind it.
- **Buttons:** the primary button uses the gradient. Success, danger and blue buttons were refined, and the segmented controls got a new style.
- **Charts:** rounded bars, circle legend markers, round line ends and redesigned tooltips. The chart palette uses the same colors as the rest of the page.
- **Tables:** gradient headers, softer row lines and a gradient highlight on the row under the mouse.
- **Other pages:** Viva, Fleet cards, Attack Lab scenarios, FL stages, the drawer and toasts all use the same style.
- **Motion:** cards fade and rise in a short sequence when a page opens, and the status dots pulse. All animation turns off when the system "reduce motion" setting is on.
- **Mobile fix:** the Viva slide text and controls no longer run off the screen on phones.

## Performance

Measured in headless Chromium with software rendering, the frame rate matches V3/V7: about 60 fps on the Dashboard, AI Detection Lab, Federated Learning, Research and Viva pages. Glass blur and drop-shadow filters on animated elements cut the frame rate roughly in half, so they were replaced with cheap radial glows. The 3D Swarm page runs at the same speed as V7.
