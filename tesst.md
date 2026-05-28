

  const accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXBwNjB5YmUwMDAwdjZrNTFzeW43cjJwIiwidXNlcm5hbWUiOiJmZXRlc3QiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzc5OTUyOTQ1LCJleHAiOjE3Nzk5NTY1NDV9.qW0P7EZ7MrEMSJOppBFI7NW1X61AWgVt8haRVo7UCxA";
const refreshToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbXBwNjB5YmUwMDAwdjZrNTFzeW43cjJwIiwidXNlcm5hbWUiOiJmZXRlc3QiLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTc3OTk1Mjk0NSwiZXhwIjoxNzgwNTU3NzQ1fQ.ajiav-M75CqfnjJvNOrEljoQOITns-OStKA7qZ3alqc";

fetch('http://localhost:3000/auth/me', {
  headers: { 'Authorization': 'Bearer ' + accessToken }
}).then(r => r.json()).then(d => {
  localStorage.setItem('auth', JSON.stringify({
    state: { user: d.user, accessToken, refreshToken, isAuthenticated: true },
    version: 0
  }));
  console.log('✅ Set xong. Reload trang. User:', d.user);
});