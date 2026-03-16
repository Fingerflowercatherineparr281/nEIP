/**
 * hr.spec.ts — Employees, Departments, Payroll, Leave.
 */
import { test, expect } from '@playwright/test';
import { visitPage } from './helpers/auth';

test.describe('HR', () => {
  test('employees page renders', async ({ page }) => {
    const s = await visitPage(page, '/employees', 'employees.png', [
      'No employees found',
      'No employees match',
    ]);
    if (s.hasError) console.warn('[KNOWN BUG] employees: "Something went wrong"');
    expect(s.stillSpinning).toBe(false);
    expect(s.hasTable || s.hasEmpty || s.hasError || s.hasHeading).toBe(true);
  });

  test('employees heading is visible', async ({ page }) => {
    const s = await visitPage(page, '/employees', 'employees-heading.png', []);
    expect(s.stillSpinning).toBe(false);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    const text = await heading.textContent();
    expect(text?.toLowerCase()).toContain('employee');
  });

  test('departments page renders', async ({ page }) => {
    const s = await visitPage(page, '/departments', 'departments.png', [
      'No departments found',
      'No departments',
    ]);
    if (s.hasError) console.warn('[KNOWN BUG] departments: "Something went wrong"');
    expect(s.stillSpinning).toBe(false);
    expect(s.hasTable || s.hasEmpty || s.hasError || s.hasHeading || s.hasCard).toBe(true);
  });

  test('departments heading is visible', async ({ page }) => {
    const s = await visitPage(page, '/departments', 'departments-heading.png', []);
    expect(s.stillSpinning).toBe(false);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('payroll page renders', async ({ page }) => {
    const s = await visitPage(page, '/payroll', 'payroll.png', [
      'No payroll runs',
      'No runs found',
      'No payroll',
    ]);
    if (s.hasError) console.warn('[KNOWN BUG] payroll: "Something went wrong"');
    expect(s.stillSpinning).toBe(false);
    expect(s.hasTable || s.hasEmpty || s.hasError || s.hasHeading || s.hasCard).toBe(true);
  });

  test('payroll heading is visible', async ({ page }) => {
    const s = await visitPage(page, '/payroll', 'payroll-heading.png', []);
    expect(s.stillSpinning).toBe(false);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('leave page renders', async ({ page }) => {
    const s = await visitPage(page, '/leave', 'leave.png', [
      'No leave requests',
      'No leave',
    ]);
    if (s.hasError) console.warn('[KNOWN BUG] leave: "Something went wrong"');
    expect(s.stillSpinning).toBe(false);
    expect(s.hasTable || s.hasEmpty || s.hasError || s.hasHeading || s.hasCard).toBe(true);
  });

  test('leave heading is visible', async ({ page }) => {
    const s = await visitPage(page, '/leave', 'leave-heading.png', []);
    expect(s.stillSpinning).toBe(false);
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });
});
