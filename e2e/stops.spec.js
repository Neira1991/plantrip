import { test, expect } from './fixtures.js'

test.describe('Stop management', () => {
  let trip

  test.beforeEach(async ({ api, page }) => {
    await api.reset()
    await api.setupAuth(page)
    trip = await api.createTrip({ name: 'France Trip', countryCode: 'FR' })
  })

  test('add a stop via city search', async ({ page, mockMapbox }) => {
    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()

    // Open itinerary
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('itinerary-panel')).toBeVisible()
    await expect(page.getByTestId('itinerary-empty')).toBeVisible()

    // Click add stop
    await page.getByTestId('btn-add-stop').click()

    // Search for city (mocked Mapbox)
    await page.getByTestId('city-search-input').fill('Paris')
    await expect(page.getByTestId('city-search-result').first()).toBeVisible()

    // Select Paris
    await page.getByTestId('city-search-result').first().click()

    // Reopen itinerary to see the stop
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('day-section')).toBeVisible()
    await expect(page.getByTestId('day-section').first()).toContainText('Paris')
  })

  test('add multiple stops and verify numbering', async ({ page, api, mockMapbox }) => {
    // Add 3 stops via API
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86 })
    await api.createStop(trip.id, { name: 'Lyon', lng: 4.84, lat: 45.76 })
    await api.createStop(trip.id, { name: 'Marseille', lng: 5.37, lat: 43.30 })

    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()

    // Verify 3 day sections (each stop has 1 night by default)
    const daySections = page.getByTestId('day-section')
    await expect(daySections).toHaveCount(3)

    // Verify city names in day headers
    await expect(daySections.nth(0)).toContainText('Paris')
    await expect(daySections.nth(1)).toContainText('Lyon')
    await expect(daySections.nth(2)).toContainText('Marseille')
  })

  test('delete a stop and verify renumbering', async ({ page, api }) => {
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86 })
    await api.createStop(trip.id, { name: 'Lyon', lng: 4.84, lat: 45.76 })
    await api.createStop(trip.id, { name: 'Marseille', lng: 5.37, lat: 43.30 })

    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('day-section')).toHaveCount(3)

    // Remove the middle stop (Lyon) - it's the second day section
    const removeBtn = page.getByTestId('btn-remove-stop').nth(1)
    await removeBtn.click()
    await page.getByTestId('btn-confirm-remove').click()

    // Verify Lyon is gone, 2 day sections remain
    await expect(page.getByTestId('day-section')).toHaveCount(2)
    const daySections = page.getByTestId('day-section')
    await expect(daySections.nth(0)).toContainText('Paris')
    await expect(daySections.nth(1)).toContainText('Marseille')
  })

  test('reorder stops and see toast about movements cleared', async ({ page, api }) => {
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86 })
    await api.createStop(trip.id, { name: 'Lyon', lng: 4.84, lat: 45.76 })
    await api.createStop(trip.id, { name: 'Marseille', lng: 5.37, lat: 43.30 })

    // Add a movement so the reorder clears it
    const stops = await api.getStops(trip.id)
    await api.createMovement(trip.id, {
      fromStopId: stops[0].id,
      toStopId: stops[1].id,
      type: 'train',
    })

    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('day-section')).toHaveCount(3)

    // Move first stop down
    await page.getByTestId('btn-move-down').first().click()

    // Verify new order
    const daySections = page.getByTestId('day-section')
    await expect(daySections.nth(0)).toContainText('Lyon')
    await expect(daySections.nth(1)).toContainText('Paris')

    // Toast about movements cleared
    await expect(page.getByTestId('itinerary-toast')).toBeVisible()
    await expect(page.getByTestId('itinerary-toast')).toContainText('Transport segments cleared')
  })
})
