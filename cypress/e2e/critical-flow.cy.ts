// FIX: The TypeScript compiler is not finding the Cypress global types,
// likely due to a missing or misconfigured tsconfig.json.
// As a workaround, we are removing the failing type reference and declaring 
// the Cypress globals as `any` to suppress the compiler errors.
// This removes type safety for this test file but makes it valid within the project setup.
declare var describe: any;
declare var it: any;
declare var cy: any;

describe('Critical Application Flow', () => {
  it('should load the login page, log in as an admin, and see the dashboard', () => {
    // Visit the root URL
    cy.visit('/');

    // Check if the login form is visible
    cy.get('h1').contains('Architecte de Solutions');
    cy.get('form').should('be.visible');

    // Enter credentials for an admin user (from mockData)
    cy.get('input[name="loginId"]').type('9000');
    cy.get('input[name="password"]').type('9000');

    // Submit the form
    cy.get('button[type="submit"]').click();

    // After login, the main app should be visible
    // Check for a key element in the admin dashboard, like the sidebar
    cy.get('aside').should('be.visible');
    cy.get('aside').contains('Solution Archi');
    
    // Check if the user's name is displayed
    cy.get('aside').contains('Admin Principal');

    // Check if the main content area is displaying a feature
    cy.get('main').contains('Utilisateurs');
  });

   it('should log in as an agent and see the agent view', () => {
    cy.visit('/');

    // Enter credentials for an agent user (from mockData)
    cy.get('input[name="loginId"]').type('1001');
    cy.get('input[name="password"]').type('1001');

    cy.get('button[type="submit"]').click();

    // After login, the agent view should be visible
    cy.get('header').contains("Interface Agent");
    cy.get('main').contains("État de l'Agent");
    // Updated test assertion to be more specific to the content displayed
    // when an agent logs in and is waiting for a call.
    cy.get('main').contains("Le script s'affichera ici.");
  });
});
