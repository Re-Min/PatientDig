# 3D 素材（Tripo 生成）

所有模型都用 Tripo v3 API（`v3.1-20260211`）文字生成，统一用“手作粘土微缩场景”风格的提示词。提示词、task id 和积分消耗都记录在 `tripo_manifest.json` 里，`previews/` 存的是 Tripo 的渲染预览图。

| 文件 | 用途 |
|---|---|
| `archaeologist.glb` | 野外古生物学者（已绑定 biped 骨骼） |
| `anim/idle·walk·dig·shovel·cheer.glb` | 角色动作，每个动作单独 retarget，只导出动画 |
| `trowel.glb` / `brush.glb` / `bamboo_pick.glb` | 小铲、毛刷、竹签 |
| `tail_vertebrae.glb` / `vertebra.glb` / `rib.glb` / `bone_fragment.glb` | 埋藏的骨骼：尾椎、椎体、肋骨片段、零散骨片 |
| `yangchuanosaurus.glb` | 和平永川龙复原模型（收录图鉴后出现） |
| `canopy.glb` / `toolbox.glb` / `site_sign.glb` / `grid_stake.glb` | 遮阳棚、工具箱、现场标牌、探方木桩 |

总共 13 个模型加 5 段动作，消耗约 375 积分。

## 流程

1. `python tools/tripo_generate.py [名称…] [--force]` 生成模型，输出到 `assets/`。API key 先读 `TRIPO_API_KEY`，没有就读 `D:/datday/2`。默认走代理 `127.0.0.1:10808`，可以用 `TRIPO_PROXY` 覆盖。
2. `python tools/optimize_glb.py` 把每个模型的 3 张 2048 贴图压成小 JPEG，输出到 `assets/opt/`（41 MB → 5.4 MB）。
3. `npm run build` 把 `assets/opt/` 里的 GLB 以二进制内联进 `dist/dig3d.js`，所以 `3d.html` 直接双击就能打开，不需要本地服务器。

## 注意

- 一次 retarget 请求里放多个动画，导出的 GLB 只会保留一段，所以脚本按动画逐个请求（`export_with_geometry: false`）。
- 骨骼化石的造型是演示用的示意，不代表真实标本形态。
