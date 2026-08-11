import { describe, expect, it } from 'vitest'
import { DISMISS_KEY, detectPlatform, isGuideDismissed, markGuideDismissed, shouldAutoShow } from '../src/lib/installGuide'

function fakeStorage(init: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map(Object.entries(init))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v) }
  }
}

describe('installGuide', () => {
  it('平台识别：iPhone → ios，Android → android，桌面 → desktop', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36')).toBe('android')
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36')).toBe('desktop')
  })

  it('iPadOS（Mac 内核 + 触屏）识别为 ios', () => {
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', 5)).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', 0)).toBe('desktop')
  })

  it('shouldAutoShow：未关闭且非独立模式才自动弹出', () => {
    expect(shouldAutoShow(false, false)).toBe(true)
    expect(shouldAutoShow(true, false)).toBe(false)
    expect(shouldAutoShow(false, true)).toBe(false)
    expect(shouldAutoShow(true, true)).toBe(false)
  })

  it('引导关闭标记：写入后可读取，未写入为 false', () => {
    const s = fakeStorage()
    expect(isGuideDismissed(s)).toBe(false)
    markGuideDismissed(s)
    expect(isGuideDismissed(s)).toBe(true)
    expect(s.getItem(DISMISS_KEY)).toBe('1')
  })
})
