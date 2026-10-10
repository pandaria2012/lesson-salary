import { shiftMonth } from '../../shared/month'

/**
 * 月份选择器：对应 Web 端 src/web/components/MonthPicker.tsx
 * Web 用 <input type="month">；小程序用 <picker mode="date" fields="month">。
 */
Component({
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
