Component({
  options: {
    multipleSlots: false,
    // 允许外部样式类，便于页面微调
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
