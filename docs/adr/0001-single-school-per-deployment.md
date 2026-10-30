# Single school per deployment

v1 serves one school per deployment, with its own database and Docker Compose stack. Rows carry no school or tenant key. This keeps every query and access check simpler. The cost is that hosting several schools later means adding a tenant key to every table and access rule, or running one stack per school.
