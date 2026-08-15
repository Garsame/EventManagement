# Database
- **users**: fullName, email (unique), phone, passwordHash, role, createdAt.
- **users.refreshTokens**: array of active refresh token strings for rotation/invalidation.
- **events**: title, description, location, startDateTime, endDateTime, visibility, published, createdBy, createdAt.
- **eventregistrations**: eventId, userId, registeredAt, registrationCode, qrToken, attended, checkedInAt, checkedInBy.
  - Indexes: unique (eventId, userId), index on registrationCode, index on qrToken.
