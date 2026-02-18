import { test, expect } from './fixtures.js'

test.describe('Activity management', () => {
  let trip, stop

  test.beforeEach(async ({ api }) => {
    await api.reset()
    trip = await api.createTrip({ name: 'France Trip', countryCode: 'FR' })
    stop = await api.createStop(trip.id, { name: 'Paris', lng: 2.35, lat: 48.86 })
  })

  test('add an activity to a stop', async ({ page }) => {
    await page.goto(`/trip/${trip.id}`)
    await expect(page.getByTestId('trip-header-name')).toBeVisible()
    await page.getByTestId('btn-open-itinerary').click()
    await expect(page.getByTestId('stop-card')).toBeVisible()

    // Type in the add-activity input
    const addInput = page.getByTestId('activity-add-input')
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

    // Click the title to enter edit mode
    await page.getByTestId('activity-title').click()

    // Change the text
    const editInput = page.getByTestId('activity-edit-input')
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

    // Click delete
    await page.getByTestId('btn-delete-activity').click()

    // Verify gone
    await expect(page.getByTestId('activity-item')).not.toBeVisible()
  })
})
