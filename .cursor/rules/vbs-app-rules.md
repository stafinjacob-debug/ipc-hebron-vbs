## Environments and Deployment Rules
- The project must support two environments from the beginning:
  1. local development on macOS
  2. production deployment in Azure
- Source control must be GitHub.
- Never hardcode secrets or credentials.
- Never commit secrets, tokens, connection strings, or keys to the repository.
- Use `.env.local` for local development.
- Provide `.env.example` with placeholder values and documentation.
- Structure the project so it can be deployed from GitHub to Azure cleanly.

## Local Development Rules
- Ensure the application runs cleanly on macOS.
- Provide setup scripts and commands for local development.
- Keep local onboarding simple and well documented.
- Prefer Docker or clear local service setup if multiple services are required.
- Include database migration and seed workflows for local dev.

## Production Deployment Rules
- Design deployment for Azure from the start.
- Recommend the most appropriate Azure hosting model based on the codebase.
- Prefer GitHub Actions for CI/CD to Azure.
- Keep deployment configuration environment-specific.
- Use Azure-managed services where practical for reliability and maintainability.
- Production configuration must be secure and repeatable.

## Infrastructure Deliverables
- Include README setup instructions for local development.
- Include deployment documentation for Azure.
- Include environment variable documentation.
- Include CI/CD workflow if deployment automation is implemented.
- Keep the app easy to run locally and easy to deploy to production.

## Credentials Handling Rules
- Assume the user may provide GitHub and Azure access details separately.
- Do not store credentials in code.
- Do not log secrets.
- Use GitHub Secrets, Azure app settings, or Azure Key Vault for secure secret storage.