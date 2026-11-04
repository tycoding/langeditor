# LangEditor 文档模式插件开发指南

> 适用范围：Spreadsheet、PDF、Presentation 及后续非 Tiptap 文档模式
> 参考实现：`@langeditor/plugin-spreadsheet`
> 目标：让新的文档引擎以独立 NPM 包接入同一个 `LangEditor`，并复用统一 UI、AI、协同和宿主协议

## 1. 先判断它是不是一个新模式

不要因为 UI 不同就创建新编辑器模式。先按下面的边界判断：

| 需求                                      | 应采用的机制                         | 示例                           |
| ----------------------------------------- | ------------------------------------ | ------------------------------ |
| 仍然编辑 Tiptap 文档，只改变工具栏或布局  | Core layout、Extension 或普通 Plugin | Mini、Word、Composer           |
| 文档具有独立选择模型、引擎和序列化格式    | 外部文档模式 `surface`               | Spreadsheet、PDF、Presentation |
| 只给现有模式增加 AI、协同、审阅或业务能力 | `createDocument()` 文档插件          | AI Workbench、Collaboration    |
| 只是转换文件，不拥有浏览器内编辑状态      | 服务端能力或 Serializer 插件         | DOCX/PDF 转换服务              |

新模式必须满足两个条件：

1. 它不能自然表示为现有 Tiptap JSON。
2. 它需要自己的文档值、选择状态和操作协议。

外部文档模式不是 Tiptap Node，也不能在内部再挂一个隐藏的 Tiptap 编辑器。

## 2. 不可破坏的总体架构

```text
<LangEditor mode="spreadsheet">
  -> LangEditorHost 根据 mode 路由
  -> 插件注册表解析 surface
  -> ExternalDocumentSurface 动态加载模式组件
  -> 模式组件创建独立引擎和 LcDocumentSession
  -> Core 渲染统一标题栏、工具栏插槽、侧栏插槽和状态栏
  -> AI / 协同 / 审阅插件通过 createDocument(session) 接入
```

责任边界：

| 层                | 负责                                                         | 不负责                                 |
| ----------------- | ------------------------------------------------------------ | -------------------------------------- |
| Core host         | mode 路由、主题、统一 chrome、插件插槽、全屏、错误和加载状态 | 文件格式实现、模式私有引擎             |
| Mode package      | 文档模型、引擎适配、选择、操作、导入导出、模式专属 UI        | 商业授权、服务端密钥、复制 Core 编辑器 |
| Document plugin   | AI、协同、评论、审阅和业务工作流                             | 直接操作模式私有 DOM 或引擎对象        |
| Framework adapter | Props、属性、方法和事件映射                                  | 复制 Vue 编辑器行为                    |

`LangEditorHost.vue` 是模式路由，`ExternalDocumentSurface.vue` 是外部模式宿主。新模式通常不需要修改它们；只有公共协议无法表达合理需求时，才扩展 Core 类型。

## 3. 包结构和注册入口

每种可独立安装的模式必须是单独 NPM 包：

```text
packages/editor-plugin-<id>/
  package.json
  README.md
  PRD.md
  LICENSE
  src/
    index.ts
    manifest.ts
    plugin.ts
    types.ts
    model/
    components/
    serializers/
    locales/
    styles/index.css
  examples/
```

商业模式包放在 `commercial/packages/`，但仍然依赖公共 Core 协议，不能实现第二套编辑器宿主。

注册入口必须保持轻量：

```ts
registerEditorPlugin({
  ...manifest,
  surfaces: [
    {
      mode: 'spreadsheet',
      capabilities: ['selection:range', 'operations', 'ai-context', 'page-layout', 'import:xlsx', 'export:xlsx'],
      minHeight: 640,
      load: () => import('./components/SpreadsheetSurface.vue'),
    },
  ],
  create: () => ({}),
  createDocument: ({ session }) => ({
    ui: session.kind === 'spreadsheet' ? spreadsheetUi(session) : [],
  }),
})
```

包由显式导入产生副作用注册：

```ts
import '@langeditor/plugin-spreadsheet'
import '@langeditor/plugin-spreadsheet/style.css'
```

`autoPlugins` 只能自动启用已经注册的插件，不能代替 NPM 包导入。缺少注册时，宿主必须显示“模式不可用”错误，不能永久停在加载状态。

## 4. Manifest 和依赖规范

Manifest 至少声明：

- 全局唯一 `id`；
- 插件版本和 Core 兼容范围；
- `requires` 与 `conflicts`；
- `provides` 与 `enhances`；
- 商业包所需的 `licenseFeature`。

引擎和格式依赖应在模式包内，不得进入 Core 或 Mini 初始包。选择依赖时逐项记录：

| 项目       | 必须确认                                         |
| ---------- | ------------------------------------------------ |
| License    | 是否允许浏览器、SaaS、修改和再分发               |
| 活跃度     | 最近提交、Issue 响应、发布节奏和维护主体         |
| 浏览器支持 | 是否依赖 Node API、Worker、WASM、Canvas 或 WebGL |
| 包体积     | 是否可动态加载，是否把无关格式一起打包           |
| 数据能力   | 读取、编辑、写出能力要分别验证，不能只看 README  |
| 安全       | 宏、外链、脚本、嵌入对象和不可信文件的处理方式   |

不要选择需要商业 Web 使用许可的运行时，也不要把“能读取样式”误认为“能写出样式”。Spreadsheet 实施中，`@e965/xlsx` 能读取样式，但 XLSX writer 不会写出字体、填充和对齐，因此导出改由 MIT 的 ExcelJS 完成，并保持按需加载。

## 5. 数据合同：Source、Snapshot 和 Session

### 5.1 Source 只负责输入

`documentSource` 用于 URL、File、Blob、ArrayBuffer、Uint8Array 或描述对象。它不应该承担持续双向状态：

```vue
<LangEditor v-model="documentValue" :document-source="file" mode="spreadsheet" />
```

### 5.2 Snapshot 是可序列化事实来源

每种模式必须定义版本化 Snapshot：

```ts
interface ExampleSnapshot {
  kind: 'langeditor-example'
  version: 1
  name: string
  pages: ExamplePage[]
  selectedPageId: string
  metadata?: Record<string, unknown>
}
```

要求：

- 可通过结构化克隆或 JSON 持久化；
- 不包含 DOM、Vue Ref、Canvas、WASM 指针和引擎实例；
- ID 稳定且名称不承担对象身份；
- 导入后执行规范化，补齐缺省值并消除重复 ID；
- Schema 变更必须升级版本或提供迁移；
- `v-model`、React、Web Component、协同和导出都以它为边界。

引擎模型是运行时缓存，Snapshot 才是跨插件和跨框架合同。任何 UI 操作都必须同步更新二者。

### 5.3 每个编辑器创建独立 Session

一个 mounted surface 对应一个 `LcDocumentSession`，绝不能共享可变引擎、Extension 或订阅：

- `getValue()` 返回 Snapshot 副本；
- `setValue()` 规范化数据并重建或增量更新引擎；
- `getSelection()` 返回可序列化选择；
- `getAIContext()` 返回有界上下文；
- `applyOperations()` 验证后执行操作；
- `subscribe()` 通知 UI 和文档插件；
- `focus()` 聚焦真正的编辑区域；
- `destroy()` 释放 Worker、WASM、监听器、Observer 和订阅。

异步加载必须带 revision 或 abort 机制。组件卸载、mode 切换或二次加载后，旧 Promise 不得覆盖新 Session。

## 6. Operation 是 AI、协同和 UI 的共同写入协议

不要让工具栏直接修改 DOM，也不要把私有引擎实例交给商业插件。所有有意义的编辑行为都应设计成操作：

```ts
type SpreadsheetOperation =
  | { type: 'spreadsheet.set-cell'; payload: { sheetId?: string; row: number; column: number; input: string } }
  | { type: 'spreadsheet.set-style'; payload: SpreadsheetCellStylePatch }
  | { type: 'spreadsheet.rename-sheet'; payload: { sheetId?: string; name: string } }
```

操作实现顺序固定：

1. 检查 operation type 是否受支持；
2. 校验 payload 类型、范围、数量上限和目标 ID；
3. 完成全部校验后再修改状态，避免部分提交；
4. 同步引擎和 Snapshot；
5. 更新选择映射；
6. 通知订阅者；
7. 发出 `update:modelValue` 和 `change`；
8. 保留 `origin`，供 AI、协同、撤销和审计使用。

Sheet 重命名不能只改标签文字。正确实现必须同时更新：

- 引擎中的 worksheet name；
- Snapshot 中的 sheet name；
- 当前 selection 的 sheet name；
- 导出文件中的 worksheet name；
- AI/协同可调用的 `rename-sheet` operation。

同理，Presentation 中的幻灯片重排、PDF 中的批注、表单或页面操作都必须进入操作协议。

## 7. 统一 UI Shell 规范

所有文档模式使用同一结构顺序：

```text
DocumentTitlebar        蓝色产品标题栏
Menubar slot            可选
Toolbar slot            可选，最多一行
Document surface        模式引擎主区域
DocumentStatusbar       底部状态栏
Floating/Bubble UI      可选覆盖层
```

### 7.1 三种容易混淆的 Header/Footer

| 名称               | 用途                             | 所有者                        | Spreadsheet 是否显示                   |
| ------------------ | -------------------------------- | ----------------------------- | -------------------------------------- |
| DocumentTitlebar   | 文件名、保存状态、格式和协作入口 | Core host                     | 显示统一蓝色标题栏                     |
| Page header/footer | 打印页眉页脚和页码               | Mode Snapshot / `page-layout` | 保存并导出，不在网格顶部模拟 Word 页面 |
| DocumentStatusbar  | 选区统计、同步状态、缩放、全屏   | Core host + 插件插槽          | 显示                                   |

`page-layout` 和 `page-chrome` 必须分开声明。Spreadsheet 可以支持打印页眉页脚，但不声明 `page-chrome`；Word、PDF 或 Presentation 只有在编辑模型确实需要可见页面区域时才声明它。

### 7.2 Toolbar

- 复用 `ActionButton`、`ActionDropdownButton`、菜单、颜色选择器、Tooltip、Separator 和 Lucide 图标；
- 不使用原生 `select` 拼装另一套视觉体系；
- 只允许一行，窄宽度按功能组折叠或进入 overflow；
- 图标按钮有本地化 `aria-label` 和 Tooltip；
- Toggle 使用 `aria-pressed`，禁用使用真实 `disabled`；
- rest、hover、focus-visible、active 和 disabled 不改变按钮几何尺寸；
- 工具栏 UI 只调用 Session Operation，不调用 grid 私有方法。

### 7.3 Statusbar

左侧放紧凑的当前文档统计，右侧放二级控制：

- Spreadsheet：工作表、选区、单元格数、计数、平均值、求和；
- PDF：当前页、总页数、选择/批注状态；
- Presentation：当前页、总页数、对象选择和播放状态；
- 通用右侧：全屏/退出全屏，必要时再增加缩放或视图模式。

全屏应作用于内部 `data-editor-shell`，而不是把 `fixed` class 放到最外层 `[data-langeditor]`。Core Tailwind 样式使用宿主后代选择器时，根节点自身 class 可能无法命中。全屏时必须覆盖整个视口、保持 Footer 可见，并在 mode 切换时自动退出。

### 7.4 高度和留白

文档模式是多层 flex 容器，必须保证完整高度链：

```text
Playground frame: fixed/responsive height
  -> demo wrapper: h-full min-h-0
    -> [data-langeditor]: height: 100%
      -> [data-editor-shell]: flex-1 min-h-0
        -> surface: h-full min-h-0
```

只设置 `min-height` 不能填满更高的父容器，会在底部产生留白。滚动只能发生在模式主区域或独立侧栏，不能靠隐藏横向滚动条掩盖布局错误。

## 8. 模式内部交互规范

- 文档引擎主区域使用稳定尺寸，不因选中、Hover、Loading 或文本变化发生跳动；
- 双击、拖拽等鼠标能力必须有键盘路径；
- Sheet/Slide 标签重命名至少支持 Enter 保存、Escape 取消和失焦保存；
- 只读模式仍允许切换 Sheet、Page 或 Slide，禁止的是写入，不是导航；
- 异步操作要有 busy/disabled 状态，失败时恢复可交互状态；
- 选择不能只靠颜色表达，需要边框、标题状态或 `aria-selected`；
- 复杂 Picker 使用公共 UI Primitive，不把菜单 Trigger 嵌套进另一个 Button；
- 所有可见文案、错误、Tooltip 和 `aria-label` 同时进入中英文 locale；
- 插件 CSS 仅用于虚拟网格、Canvas、原生伪元素或第三方 DOM 等 Tailwind 难以稳定表达的部分。

## 9. 引擎适配规范

模式包应在 `model/` 下增加适配层，不让 Vue 组件到处调用引擎 API：

```text
Vue surface
  -> Workbook/Document model adapter
    -> third-party engine
  -> serializable Snapshot
```

适配层负责：

- 1-based/0-based 坐标转换；
- ID、名称、地址和范围规范化；
- 引擎操作与 Snapshot 同步；
- 选择和合并区域映射；
- 引擎重建和销毁；
- 引擎错误转为稳定错误或诊断码。

不要通过读取网格 DOM 生成导出文件，也不要为了视觉更新直接改第三方 DOM。Canvas/虚拟列表只是渲染，不能成为数据来源。

## 10. 导入导出和保真度

### 10.1 读取和写出必须分开验证

格式库常见能力不对称：

| 能力       | 独立验证内容                                           |
| ---------- | ------------------------------------------------------ |
| Import     | 值、公式、类型、样式、合并、尺寸、分页、宏、图表、图片 |
| Edit model | 哪些字段可修改，哪些只能保留或降级                     |
| Export     | 生成文件是否真的包含修改后的字段                       |
| Round trip | 导出后重新读取，是否与 Snapshot 一致                   |

不要用“成功生成文件”作为验收。至少生成包含字体、字号、颜色、填充、对齐、换行、合并、公式、行高列宽和页眉页脚的样例，再用独立 reader 重新读取断言。

CSV/TSV 没有样式、Sheet、合并和页眉页脚，导出 CSV 时必须明确是当前 Sheet 的纯数据导出。

### 10.2 Serializer 必须可替换并按需加载

```ts
export async function exportSpreadsheet(snapshot, format) {
  if (format === 'xlsx') {
    const { exportXlsx } = await import('./xlsx')
    return exportXlsx(snapshot)
  }
  const { exportCsv } = await import('./csv')
  return exportCsv(snapshot)
}
```

大型 writer 再做二级动态加载。Spreadsheet 的 ExcelJS 只在用户实际导出 XLSX 时加载，不能进入 Core、Mini 或普通 Spreadsheet 首屏。

浏览器下载使用 Blob URL 时，应临时挂载 `<a download>`，点击后移除节点，并延迟撤销 URL，避免浏览器尚未开始读取就失效。

### 10.3 不支持的内容必须可诊断

为导入定义结构化 diagnostics，例如：

```ts
type ImportDiagnostic = {
  code: 'macros-ignored' | 'charts-unsupported' | 'styles-partial'
  severity: 'info' | 'warning'
  page?: string
  detail?: string
}
```

不要静默丢失宏、图表、图片、外链、数据验证、批注或动画。README/PRD 必须列出完整保真范围和降级行为。

## 11. AI 和协同接入

AI、协同和审阅插件只依赖 Session 与 capability：

```text
createDocument({ session, capabilities })
  -> has capability?
  -> read bounded selection/context
  -> emit validated operations
  -> subscribe to document changes
```

AI context 要有明确上限：

- Spreadsheet 按单元格数截断；
- PDF 按页数/字符数截断；
- Presentation 按幻灯片/对象数截断；
- 返回 `metadata.truncated`，不能悄悄遗漏。

协同插件不能寻找某个私有 storage name，也不能监听商业私有事件。内容同步由模式 `document` contribution 和 provider-neutral 的 `lc-document-sync` 状态事件完成。远端变更应进入同一 Operation/Value 生命周期，并保留 `origin: 'remote'`。

## 12. Framework 和宿主协议

同一个 `mode`、`documentSource`、`v-model`、`session-ready` 和 `getSession()` 合同必须覆盖：

- Vue；
- Web Component；
- React adapter；
- 原生 JS、Svelte、Angular、JSP/Servlet 等 Web Component 宿主。

复杂配置通过 DOM property 传递，不能 JSON 字符串化进 attribute。React 只映射 props/ref/events，不复制模式 UI。公共类型变化时同步修改：

- `src/index.ts`；
- `src/mini.ts`（只导出轻量协议，不引入运行时）；
- `src/element/types.ts` 和 Web Component 实现；
- React 声明和薄包装；
- README 与最小示例。

## 13. Public、Commercial 和 Playground 边界

- 公共模式包位于 `packages/`，不能导入 `commercial/`；
- 商业 AI/协同插件位于 `commercial/packages/`，通过 Session 增强公共模式；
- 商业 license 可以控制商业 contribution 是否注册，但不能复制文档引擎；
- 公共最小示例位于 `examples/`；
- 企业完整案例只放在 `commercial/apps/playground/enterprise` 对应页面；
- 两个 Git 仓库分别检查状态、diff 和构建，不要互相追踪文件。

新商业插件实施前必须先完成 README/PRD，说明 license feature、UI 位置、AI 行为、失败/过期状态和与模式的能力矩阵。

## 14. 开发流程

### Phase 0：先写 PRD 和能力矩阵

- 文件格式和编辑范围；
- 引擎/Serializer 许可证与维护情况；
- Snapshot schema；
- selection 和 operations；
- UI placement；
- AI/协同能力；
- 失败和保真诊断；
- 包体积预算。

### Phase 1：注册空 Surface

- 创建 NPM 包和 Manifest；
- 通过副作用注册 mode；
- 实现动态 `load()`；
- 显示明确 loading、unavailable 和 retry；
- 验证多个实例独立挂载和销毁。

### Phase 2：完成数据和 Session

- Snapshot normalize/clone；
- Engine adapter；
- Selection；
- `getValue/setValue`；
- Operation validation；
- subscriptions 和 destroy。

### Phase 3：接入统一 UI

- 蓝色 DocumentTitlebar；
- 单行 Toolbar contribution；
- 模式 Surface；
- Statusbar statistics 和全屏；
- 可选 Sidebar/Bubble/Floating；
- 中英文 locale 和键盘操作。

### Phase 4：实现 Serializer

- Import；
- Export；
- 独立 round-trip 校验；
- diagnostics；
- 动态 chunk 检查。

### Phase 5：接入 AI 和协同

- bounded AI context；
- 操作 schema；
- remote origin；
- provider-neutral sync state；
- 商业插件按 capability 降级。

### Phase 6：补示例和发布资料

- Vue、React、Web Component 最小示例；
- 企业 Playground 独立案例；
- README/PRD/License；
- package exports、types 和 CSS；
- 发布包内容检查。

## 15. 验证矩阵

### 静态检查

```bash
pnpm type:check
pnpm lint
pnpm --dir packages/editor-plugin-<id> typecheck
pnpm --dir packages/editor-plugin-<id> build
git diff --check
```

存在私有工作区时追加：

```bash
pnpm --dir commercial typecheck
pnpm --dir commercial build:playground
git -C commercial diff --check
```

### 必测运行场景

| 场景          | 验收标准                                          |
| ------------- | ------------------------------------------------- |
| 未导入插件包  | 显示模式不可用，不永久 Loading                    |
| 首次动态加载  | Ready 只触发一次，工具栏在 Session 后创建         |
| 快速切换 mode | 旧异步结果不会覆盖新 Surface                      |
| 多实例        | 引擎、选择、订阅和销毁互不影响                    |
| 只读          | 可浏览和切换页面，但不能写入                      |
| 窄宽度        | 无第二工具栏行、无页面横向溢出                    |
| 高容器        | Surface 和 Footer 填满容器，无底部空白            |
| 全屏          | Shell 覆盖视口，Footer 可见，可退出并恢复高度     |
| 深色模式      | 选择、焦点、错误和禁用状态可辨识                  |
| 长中英文      | 标签、Tooltip 和按钮不重叠                        |
| 导入失败      | 本地化错误和可重试状态明确                        |
| 导出          | 修改后的值、样式、结构和页面设置真实写入文件      |
| AI/协同       | 只通过 Session/Operation 工作，不访问私有 DOM     |
| 销毁          | 无残留 Worker、事件、Observer、Tooltip 和内存引用 |

浏览器控制台要在干净页面会话中检查。开发期间 HMR 失败记录可能残留在旧会话，不能把历史日志误判为当前错误，也不能因此忽略新错误。

## 16. 完成标准

文档模式只有同时满足以下条件才算完成：

- 以独立 NPM 包发布，许可证和依赖边界清楚；
- `<LangEditor mode="...">` 可直接切换模式；
- 每个实例拥有独立 Session 和引擎生命周期；
- Snapshot、Selection、Operation 和 Serializer 合同已文档化；
- 使用统一标题栏、工具栏插槽、状态栏和全屏行为；
- 中英文、本地化错误、键盘和无障碍状态完整；
- AI 和协同能通过 capability + Session 接入；
- 导入导出经过真实 round-trip，而不是只检查下载成功；
- 大型引擎和 writer 均保持动态加载；
- 公共示例和企业案例位于正确仓库；
- 类型、Lint、包构建、Playground 构建和 diff 检查全部通过；
- README/PRD 明确列出不支持或只能部分保真的能力。
