import { test, expect } from './fixtures.js'

test.describe('Movement management', () => {
  let trip, stops

  test.beforeEach(async ({ api, page }) => {
    await api.reset()
    await api.setupAuth(page)
    trip = await api.createTrip({ name: 'France Trip', countryCode: 'FR' })
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86 })
    await api.createStop(trip.id, { name: 'Lyon', lng: 4.84, lat: 45.76 })
    stops = await api.getStops(trip.id)
  })

  test('add a movement between stops', async ({ page }) => {
    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('day-section').first()).toBeVisible()

    // Click "+ transport" button
    await page.getByTestId('btn-add-movement').click()

    // Select train type (should be default, but click to be sure)
    const trainBtn = page.locator('.movement-type-btn').first()
    await trainBtn.click()

    // Fill carrier and duration
    await page.getByTestId('movement-carrier-input').fill('TGV')
    await page.getByTestId('movement-duration-input').fill('120')

    // Save
    await page.getByTestId('btn-save-movement').click()

    // Verify summary is shown
    await expect(page.getByTestId('movement-summary')).toBeVisible()
    await expect(page.getByTestId('movement-summary')).toContainText('Train')
    await expect(page.getByTestId('movement-summary')).toContainText('TGV')
    await expect(page.getByTestId('movement-summary')).toContainText('2h')
  })

  test('edit a movement', async ({ page, api }) => {
    // Create a movement via API
    await api.createMovement(trip.id, {
      fromStopId: stops[0].id,
      toStopId: stops[1].id,
      type: 'train',
      carrier: 'TGV',
      durationMinutes: 120,
    })

    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('movement-summary')).toBeVisible()

    // Click the summary to edit
    await page.getByTestId('movement-summary').click()

    // Change to plane
    const planeBtn = page.locator('.movement-type-btn').nth(2)
    await planeBtn.click()

    // Update carrier
    await page.getByTestId('movement-carrier-input').fill('Air France')
    await page.getByTestId('movement-duration-input').fill('60')

    // Save
    await page.getByTestId('btn-save-movement').click()

    // Verify updated summary
    await expect(page.getByTestId('movement-summary')).toContainText('Plane')
    await expect(page.getByTestId('movement-summary')).toContainText('Air France')
    await expect(page.getByTestId('movement-summary')).toContainText('1h')
  })

  test('delete a movement', async ({ page, api }) => {
    await api.createMovement(trip.id, {
      fromStopId: stops[0].id,
      toStopId: stops[1].id,
      type: 'train',
      carrier: 'TGV',
      durationMinutes: 120,
    })

    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('movement-summary')).toBeVisible()

    // Click summary to open editor
    await page.getByTestId('movement-summary').click()

    // Click Delete
    await page.getByTestId('btn-delete-movement').click()

    // Verify movement summary is gone, add button reappears
    await expect(page.getByTestId('movement-summary')).not.toBeVisible()
    await expect(page.getByTestId('btn-add-movement')).toBeVisible()
  })
})
