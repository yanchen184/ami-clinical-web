import { test } from '@playwright/test'

const MANUAL = `file:///Users/yanchen/workspace/ami/docs/manual_phase_b_v3.html`
const OUT = `/Users/yanchen/workspace/ami/docs/testing/preview_phase_b_v3`

test.use({ viewport: { width: 1280, height: 900 } })
test.setTimeout(120_000)

test('preview manual', async ({ page }) => {
  await page.goto(MANUAL)
  await page.waitForTimeout(800)

  // 封面
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}_01_cover.png`, fullPage: false })

  // Part 1
  await page.evaluate(() => document.getElementById('part-1')?.scrollIntoView())
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}_02_part1.png`, fullPage: false })

  // Part 2 頂端
  await page.evaluate(() => document.getElementById('part-2')?.scrollIntoView())
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}_03_part2_top.png`, fullPage: false })

  // Part 4 diff
  await page.evaluate(() => document.getElementById('part-4')?.scrollIntoView())
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}_04_part4.png`, fullPage: false })

  // Part 4 diff table (scroll past the headline so the diff is centered)
  await page.evaluate(() => {
    const sec = document.getElementById('part-4')
    if (sec) window.scrollBy(0, 700)
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}_04b_part4_diff.png`, fullPage: false })

  // Part 5
  await page.evaluate(() => document.getElementById('part-5')?.scrollIntoView())
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}_05_part5.png`, fullPage: false })
})
