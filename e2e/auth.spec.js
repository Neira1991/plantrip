import { test, expect } from './fixtures.js'

test.describe('Authentication', () => {
  test.beforeEach(async ({ api }) => {
    await api.reset()
  })

  test('register new user and redirect to home', async ({ page }) => {
    await page.goto('/register')

    await page.getByTestId('auth-email').fill('newuser@test.com')
    await page.getByTestId('auth-password').fill('password123')
    await page.getByTestId('auth-confirm-password').fill('password123')
    await page.getByTestId('auth-submit').click()

    // Should redirect to home page
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('country-search-input')).toBeVisible()
  })

  test('login with valid credentials and redirect to home', async ({ page, api }) => {
    // Create a user first via API
    await api.createTestUser()

    await page.goto('/login')

    await page.getByTestId('auth-email').fill(api.accessToken ? '' : '')
    // We need the actual email — register directly via the page
    await page.goto('/register')
    await page.getByTestId('auth-email').fill('login-test@test.com')
    await page.getByTestId('auth-password').fill('password123')
    await page.getByTestId('auth-confirm-password').fill('password123')
    await page.getByTestId('auth-submit').click()
    await expect(page).toHaveURL('/')

    // Now logout and login again
    await page.getByTestId('btn-logout').click()
    await expect(page).toHaveURL('/login')

    await page.getByTestId('auth-email').fill('login-test@test.com')
    await page.getByTestId('auth-password').fill('password123')
    await page.getByTestId('auth-submit').click()

    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('country-search-input')).toBeVisible()
  })

  test('login with wrong password shows error', async ({ page }) => {
    // Register a user first
    await page.goto('/register')
    await page.getByTestId('auth-email').fill('wrongpass@test.com')
    await page.getByTestId('auth-password').fill('password123')
    await page.getByTestId('auth-confirm-password').fill('password123')
    await page.getByTestId('auth-submit').click()
    await expect(page).toHaveURL('/')

    // Logout
    await page.getByTestId('btn-logout').click()
    await expect(page).toHaveURL('/login')

    // Try to login with wrong password
    await page.getByTestId('auth-email').fill('wrongpass@test.com')
    await page.getByTestId('auth-password').fill('wrongpassword')
    await page.getByTestId('auth-submit').click()

    await expect(page.getByTestId('auth-error')).toBeVisible()
    await expect(page.getByTestId('auth-error')).toContainText('Invalid email or password')
  })

  test('register duplicate email shows error', async ({ page }) => {
    // Register first user
    await page.goto('/register')
    await page.getByTestId('auth-email').fill('duplicate@test.com')
    await page.getByTestId('auth-password').fill('password123')
    await page.getByTestId('auth-confirm-password').fill('password123')
    await page.getByTestId('auth-submit').click()
    await expect(page).toHaveURL('/')

    // Logout
    await page.getByTestId('btn-logout').click()
    await expect(page).toHaveURL('/login')

    // Try to register again with same email
    await page.goto('/register')
    await page.getByTestId('auth-email').fill('duplicate@test.com')
    await page.getByTestId('auth-password').fill('password456')
    await page.getByTestId('auth-confirm-password').fill('password456')
    await page.getByTestId('auth-submit').click()

    await expect(page.getByTestId('auth-error')).toBeVisible()
    await expect(page.getByTestId('auth-error')).toContainText('Email already registered')
  })

  test('unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })

  test('logout redirects to /login', async ({ page, api }) => {
    await api.setupAuth(page)

    await page.goto('/')
    await expect(page.getByTestId('country-search-input')).toBeVisible()

    await page.getByTestId('btn-logout').click()
    await expect(page).toHaveURL('/login')
  })
})
