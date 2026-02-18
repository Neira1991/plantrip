import { test, expect } from './fixtures.js'

test.describe('Activity management', () => {
  let trip, stop

  test.beforeEach(async ({ api, page }) => {
    await api.reset()
    await api.setupAuth(page)
    trip = await api.createTrip({ name: 'France Trip', countryCode: 'FR' })
    stop = await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86 })
  })

  test('add an activity to a stop', async ({ page }) => {
    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('day-section')).toBeVisible()

    // Type in the add-activity input
    const addInput = page.getByTestId('add-activity-input')
    await addInput.fill('Visit Eiffel Tower')
    await addInput.press('Enter')

    // Verify activity appears
    await expect(page.getByTestId('activity-item')).toBeVisible()
    await expect(page.getByTestId('activity-title')).toHaveText('Visit Eiffel Tower')
  })

  test('edit an activity', async ({ page, api }) => {
    await api.createActivity(stop.id, { title: 'Original Activity' })

    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('activity-item')).toBeVisible()

    // Click the activity item to enter edit mode
    await page.getByTestId('activity-item').click()

    // Change the text
    const editInput = page.getByTestId('activity-title-input')
    await editInput.fill('Updated Activity')
    await editInput.press('Enter')

    // Verify updated
    await expect(page.getByTestId('activity-title')).toHaveText('Updated Activity')
  })

  test('delete an activity', async ({ page, api }) => {
    await api.createActivity(stop.id, { title: 'Activity to Delete' })

    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('activity-item')).toBeVisible()

    // Click delete (the X button on the activity item)
    await page.getByTestId('btn-remove-activity').click()

    // Verify gone
    await expect(page.getByTestId('activity-item')).not.toBeVisible()
  })
})
