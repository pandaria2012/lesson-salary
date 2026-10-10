Component({
  options: {
    // slot 内容来自页面（表单字段等），需要全局样式共享，
    // 否则 app.wxss 里的 .field / .input / .btn 在组件内不生效。
    addGlobalClass: true
  },

  properties: {
    open: { type: Boolean, value: false },
    title: { type: String, value: '' }
  },

  methods: {
    onMaskTap() {
      this.triggerEvent('close')
    },

    /** 阻止点击面板时冒泡到遮罩 */
    noop() {},

    onCloseTap() {
      this.triggerEvent('close')
    }
  }
})
