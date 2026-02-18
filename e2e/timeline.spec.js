import { test, expect } from './fixtures.js'

test.describe('Timeline', () => {
  test.beforeEach(async ({ api, page }) => {
    await api.reset()
    await api.setupAuth(page)
  })

  test('day sections match stop nights', async ({ page, api }) => {
    // Create trip with 2 stops
    const trip = await api.createTrip({ name: 'Timeline Test' })
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86, nights: 2 })
    await api.createStop(trip.id, { name: 'Lyon', lng: 4.83, lat: 45.76, nights: 1 })

    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-open-itinerary').click()

    // Should show 3 day sections (2 nights in Paris + 1 night in Lyon)
    const daySections = page.getByTestId('day-section')
    await expect(daySections).toHaveCount(3)

    // Verify day numbers
    const dayNumbers = page.getByTestId('day-number')
    await expect(dayNumbers.nth(0)).toContainText('Day 1')
    await expect(dayNumbers.nth(1)).toContainText('Day 2')
    await expect(dayNumbers.nth(2)).toContainText('Day 3')

    // Verify city names
    await expect(daySections.nth(0)).toContainText('Paris')
    await expect(daySections.nth(1)).toContainText('Paris')
    await expect(daySections.nth(2)).toContainText('Lyon')
  })

  test('changing nights updates timeline', async ({ page, api }) => {
    const trip = await api.createTrip({ name: 'Nights Test' })
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86, nights: 1 })

    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-open-itinerary').click()

    // Initially 1 day section
    await expect(page.getByTestId('day-section')).toHaveCount(1)

    // Click nights badge to edit, change to 3
    await page.getByTestId('nights-badge').click()
    await page.getByTestId('nights-input').fill('3')
    await page.getByTestId('nights-input').press('Enter')

    // Should now show 3 day sections
    await expect(page.getByTestId('day-section')).toHaveCount(3)

    // All should show Paris
    const daySections = page.getByTestId('day-section')
    await expect(daySections.nth(0)).toContainText('Paris')
    await expect(daySections.nth(1)).toContainText('Paris')
    await expect(daySections.nth(2)).toContainText('Paris')
  })

  test('activity time and duration editing', async ({ page, api }) => {
    const trip = await api.createTrip({ name: 'Activity Time Test' })
    const stop = await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86 })
    await api.createActivity(stop.id, { title: 'Visit Eiffel Tower' })

    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-open-itinerary').click()

    // Click activity to edit
    await page.getByTestId('activity-item').click()

    // Set time and duration
    await page.getByTestId('activity-time-input').fill('09:00')
    await page.getByTestId('activity-duration-input').fill('120')
    await page.getByTestId('btn-save-activity').click()

    // Verify badges appear
    await expect(page.getByTestId('activity-time-badge')).toContainText('9:00 AM')
    await expect(page.getByTestId('activity-duration-badge')).toContainText('2h')
  })

  test('end date auto-updates with stops', async ({ page, api }) => {
    const trip = await api.createTrip({ name: 'End Date Test', startDate: '2026-06-01' })

    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()

    // Initially no date range shown (no stops)
    const headerDates = page.locator('.trip-header-dates')
    const initialDatesCount = await headerDates.count()

    // Add a stop with 2 nights via API
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86, nights: 2 })

    // Reload to see updated trip
    await page.reload()
    await expect(page.getByTestId('trip-header-name')).toBeVisible()

    // Now date range should appear
    await expect(page.locator('.trip-header-dates')).toBeVisible()

    // Open edit form to verify end date is computed
    await page.getByTestId('btn-edit-trip').click()

    // Verify read-only end date display exists
    await expect(page.getByTestId('trip-end-date-display')).toBeVisible()
    await expect(page.getByTestId('trip-end-date-display')).toContainText('2026')
  })

  test('stop controls only on first day of multi-night stop', async ({ page, api }) => {
    const trip = await api.createTrip({ name: 'Multi-night Test' })
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86, nights: 3 })

    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-open-itinerary').click()

    // Should have 3 day sections
    await expect(page.getByTestId('day-section')).toHaveCount(3)

    // Stop controls should only appear once (on first day)
    const stopControls = page.getByTestId('stop-controls')
    await expect(stopControls).toHaveCount(1)

    // Verify it's in the first day section
    const firstDay = page.getByTestId('day-section').first()
    await expect(firstDay.getByTestId('stop-controls')).toBeVisible()
  })

  test('activities can be added to any day of a multi-night stop', async ({ page, api }) => {
    const trip = await api.createTrip({ name: 'Multi-day Activities Test' })
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86, nights: 2 })

    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-open-itinerary').click()

    // Should have 2 day sections
    const daySections = page.getByTestId('day-section')
    await expect(daySections).toHaveCount(2)

    // Add activity to first day
    const day1Input = daySections.nth(0).getByTestId('add-activity-input')
    await day1Input.fill('Visit Louvre')
    await day1Input.press('Enter')

    // Add activity to second day
    const day2Input = daySections.nth(1).getByTestId('add-activity-input')
    await day2Input.fill('Visit Eiffel Tower')
    await day2Input.press('Enter')

    // Verify both activities appear in correct days
    await expect(daySections.nth(0)).toContainText('Visit Louvre')
    await expect(daySections.nth(1)).toContainText('Visit Eiffel Tower')

    // Verify each day has one activity
    await expect(daySections.nth(0).getByTestId('activity-item')).toHaveCount(1)
    await expect(daySections.nth(1).getByTestId('activity-item')).toHaveCount(1)
  })

  test('activity search: selecting a suggestion creates activity with location', async ({ page, api, mockSearchBox }) => {
    const trip = await api.createTrip({ name: 'Search Test' })
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86, nights: 1 })

    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-open-itinerary').click()

    const input = page.getByTestId('add-activity-input')
    await input.fill('Eiffel')

    // Dropdown should appear with suggestions
    await expect(page.getByTestId('activity-search-dropdown')).toBeVisible()
    const options = page.getByTestId('activity-search-option')
    await expect(options).toHaveCount(2)
    await expect(options.first()).toContainText('Eiffel Tower')

    // Click first suggestion
    await options.first().click()

    // Activity should be created with location badge
    const activityItem = page.getByTestId('activity-item')
    await expect(activityItem).toHaveCount(1)
    await expect(activityItem).toContainText('Eiffel Tower')
    await expect(page.getByTestId('activity-location-badge')).toBeVisible()
  })

  test('activity search: free-text Enter creates activity without location', async ({ page, api, mockSearchBox }) => {
    const trip = await api.createTrip({ name: 'Free Text Test' })
    await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86, nights: 1 })

    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-open-itinerary').click()

    const input = page.getByTestId('add-activity-input')
    await input.fill('Pack bags')
    await input.press('Enter')

    // Activity should be created without location badge
    const activityItem = page.getByTestId('activity-item')
    await expect(activityItem).toHaveCount(1)
    await expect(activityItem).toContainText('Pack bags')
    await expect(page.getByTestId('activity-location-badge')).toHaveCount(0)
  })

  test('activity created via API with coordinates shows location badge', async ({ page, api }) => {
    const trip = await api.createTrip({ name: 'Location Badge Test' })
    const stop = await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86 })
    await api.createActivity(stop.id, { title: 'Eiffel Tower', lng: 2.2945, lat: 48.8584, address: 'Champ de Mars' })

    await page.goto(`/trip/${trip.id}`)
    await page.getByTestId('btn-open-itinerary').click()

    await expect(page.getByTestId('activity-item')).toContainText('Eiffel Tower')
    await expect(page.getByTestId('activity-location-badge')).toBeVisible()
  })
})
