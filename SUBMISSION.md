# TrustVault â€” Project Submission



**Author:** Dega Leela Ramana

**Challenge:** Snovasys Fresher Hiring Challenge 2026

**Live Application:** https://trustvault-app-fczr.onrender.com/



## 1. What I Built



TrustVault is a secure document-management application that allows users to upload, manage, and share documents with controlled permissions.



The application uses React and Vite for the frontend, Express.js for the backend, Prisma ORM with PostgreSQL for database operations, and private Supabase Storage for production document storage.



Key features include:

- User authentication and role-based access control.

- Document upload, listing, downloading, updating, and deletion.

- Document sharing with read and edit permissions.

- Owner-controlled permission management and revocation.

- Backend authorization checks for protected operations.

- A tamper-evident audit hash chain with an administrator verification endpoint.

- Automated tests and project documentation.



## 2. What I Deliberately Did Not Build



I focused on the core document-management and security requirements instead of adding unrelated features.



I did not implement an independently anchored audit log. The audit hash chain provides tamper detection, but a privileged database operator could potentially rewrite the chain and recompute its hashes.



The audit verification endpoint also does not verify every historical entry, so its result must be interpreted alongside the reported verification counts and legacy entries.



## 3. Permission Model



TrustVault uses authentication and server-side authorization to control access to documents.



- **Authenticated users:** Can access protected application functionality according to their permissions.

- **Document owners:** Can manage their documents and control sharing permissions.

- **Users with read permission:** Can access and download shared documents but cannot modify or delete them solely on the basis of read access.

- **Users with edit permission:** Can perform permitted document-editing operations.

- **Administrators:** Can access administrator-only functionality, including audit-chain verification.



Authorization is enforced by the backend rather than relying only on frontend controls. A user should not be able to access another user's documents simply by changing a document ID.



During production testing, the audit verification endpoint returned `FORBIDDEN` for a normal user, confirming that the administrator-only restriction was enforced in that test.



## 4. How I Used AI



I used AI for planning, implementation guidance, debugging, test support, and reviewing project documentation and security-related code.



AI assistance helped me understand implementation options and identify areas that needed additional validation. However, generated suggestions were not accepted blindly. I reviewed the relevant code, ran automated tests, checked the production application, and verified important authorization behavior.



One important example was file-upload validation. MIME-type checks alone are insufficient to establish that an uploaded file is valid. I added basic file-signature checks for supported PDF, JPEG, and PNG files, along with UTF-8 validation for text files and rejection of null bytes. These checks improve validation but do not constitute complete file-format verification.



The `PROMPTS.md` file documents my AI-assisted development process, including mistakes, corrections, and verification steps.



## 5. Testing and Verification



The project has automated tests covering application behavior and security-related functionality.



- **Automated tests:** 62 tests passed across 11 test files.

- **Frontend production build:** Passed.

- **Production login:** Tested with demo accounts.

- **Administrator authorization:** Verified that a normal user was denied access to the audit verification endpoint.

- **Audit verification:** The latest observed result reported `valid: true`, `checked: 9`, `total: 17`, and `legacyCount: 8`.



The audit result means that nine entries were checked and eight were classified as legacy entries. It does not mean all 17 entries were verified.



## 6. Remaining Limitations and Work



- Eight legacy audit entries were excluded from the verified count in the latest observed result.

- Audit-chain integrity is not independently anchored outside the database.

- The final review of cross-user authorization tests and clean-clone database setup must be completed before submission.



## 7. Project Links



- **Live Application:** https://trustvault-app-fczr.onrender.com/

- **GitHub Repository:** https://github.com/Dega-Leela-Ramana/snovasys-hiring-challenge

- **Deployment Guide:** `DEPLOY.md`

- **API Documentation:** `API.md`

- **Threat Model:** `THREATS.md`

- **AI Usage Diary:** `PROMPTS.md`



## 8. Demonstration Video



**Demo Video:** [Watch the TrustVault demonstration](https://drive.google.com/file/d/1hiVzOLa_uof7-c1pEeK9d7Y4Ny6FQbmJ/view?usp=sharing)
