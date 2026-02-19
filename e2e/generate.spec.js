import { test, expect } from './fixtures.js'

test.describe('AI Generate Itinerary', () => {
  let trip

  test.beforeEach(async ({ api, page }) => {
    await api.reset()
    await api.setupAuth(page)
    trip = await api.createTrip({
      name: 'Italy Trip',
      countryCode: 'IT',
      startDate: '2026-06-01',
    })
  })

  test('generates itinerary from AI prompt', async ({ page }) => {
    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()

    // Click AI generate button
    await page.getByTestId('btn-ai-generate').click()

    // Fill in the prompt
    await page.getByTestId('ai-prompt-input').fill('__TEST__ generate a 4-day Italy itinerary')

    // Submit
    await page.getByTestId('btn-ai-submit').click()

    // Wait for itinerary panel to open with generated stops
    await expect(page.getByText('Rome').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Florence').first()).toBeVisible()
  })

  test('shows AI button only in view mode', async ({ page }) => {
    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('btn-ai-generate')).toBeVisible()

    // Enter edit mode
    await page.getByTestId('btn-edit-trip').click()

    // AI button should be hidden in edit mode
    await expect(page.getByTestId('btn-ai-generate')).not.toBeVisible()
  })

  test('disables submit when prompt is empty', async ({ page }) => {
    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-ai-generate').click()

    // Submit button should be disabled when textarea is empty
    await expect(page.getByTestId('btn-ai-submit')).toBeDisabled()
  })

  test('can cancel AI prompt overlay', async ({ page }) => {
    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-ai-generate').click()

    // Overlay should be visible
    await expect(page.getByTestId('ai-prompt-input')).toBeVisible()

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Overlay should be gone
    await expect(page.getByTestId('ai-prompt-input')).not.toBeVisible()
  })
})
