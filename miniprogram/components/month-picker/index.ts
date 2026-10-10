import { shiftMonth } from '../../shared/month'

/**
 * 月份选择器：对应 Web 端 src/web/components/MonthPicker.tsx
 * Web 用 <input type="month">；小程序用 <picker mode="date" fields="month">。
 *
 * ⚠️ 必须开启 addGlobalClass（等价 styleIsolation: 'apply-shared'）：
 * 小程序自定义组件默认样式隔离，app.wxss 里为 .month-picker / .nav-btn / .month-label
 * 写的规则**不会**作用到组件内部节点。不开这个开关，布局会退化成竖排
 * （picker 是块级元素，‹ / 月份 / › 各占一行）。
 */
Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    month: { type: String, value: '' }
  },

  methods: {
    onPrev() {
      this.triggerEvent('change', { month: shiftMonth(this.data.month, -1) })
    },

    onNext() {
      this.triggerEvent('change', { month: shiftMonth(this.data.month, 1) })
    },

    onPick(e: WechatMiniprogram.PickerChange) {
      const v = String(e.detail.value)
      // picker fields="month" 返回 YYYY-MM
      if (v) this.triggerEvent('change', { month: v.slice(0, 7) })
    }
  }
})
