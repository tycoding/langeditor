# Tippy 样式隔离

LangEditor 内部使用 Tippy 支持 SlashCommand、Mention、BubbleMenu 和拖拽句柄。Tippy 的 DOM class（例如 `.tippy-box` 和 `.tippy-arrow`）是全局名称，宿主应用如果使用裸选择器覆盖它们，就可能改变编辑器弹层的边框、背景、箭头或间距。

## Core 的隔离行为

`@langeditor/core` 不会修改 Tippy 的全局默认配置。每个由编辑器创建的 Tippy 实例都会：

- 使用 `theme: 'langeditor'`、`arrow: false` 和 `delay: 0` 的实例级默认值；
- 在 `[data-tippy-root]` 和 `.tippy-box` 上写入 `data-langeditor-editor`；
- 在 Portal 根节点补上 `data-langeditor`，让 core 的命名空间样式继续覆盖弹层内部组件；
- 由 core 样式按该属性重置宿主可能添加的边框、阴影、背景和箭头。

因此，编辑器弹层即使通过 Portal 挂载到 `document.body`，Tippy 外壳和弹层内部组件也都保留 core 的样式作用域。

## 父项目的样式约束

父项目应将自己的 Tippy 样式限定在自己的标识下，不要直接覆盖全局 `.tippy-box` 或 `.tippy-arrow`：

```ts
import type { Instance } from 'tippy.js'

function markAppTippy(instance: Instance) {
  instance.popper.dataset.appTippy = ''
}
```

```css
[data-tippy-root][data-app-tippy] > .tippy-box {
  border: 1px solid var(--app-tooltip-border);
}

[data-tippy-root][data-app-tippy] > .tippy-box > .tippy-arrow {
  display: block;
}
```

如果现有组件库通过 `initTippy()` 设置了全局默认值，可以继续保留；编辑器会为自己的实例显式覆盖会影响布局的默认值。宿主仍应避免全局 `.tippy-box { ... !important }`，因为这会影响未标记的第三方弹层。

## 需要自定义编辑器弹层时

优先给编辑器内部容器添加业务 class，或使用 Tippy 的实例选项修改定位和动画。只有在确实需要改 core 默认外观时，才使用以下命名空间：

```css
[data-tippy-root][data-langeditor-editor] > .tippy-box {
  /* 仅覆盖你明确需要改变的属性。 */
}
```

不要通过重新安装一份 `tippy.js` 解决冲突。Tippy 的 class 和注入样式仍然是全局的，重复依赖不能提供 CSS 隔离。
