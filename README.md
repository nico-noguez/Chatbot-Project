A microservice architecture implementing CRUD functionality on a chatbot database with central authentication and role based access control.

## Highlights
  - **CAS Integration**: SSO using Virginia Tech CAS
  - **JWT Tokens**: Used to track authentication for 24 hours
  - **RBAC**: Three tier authorization system (admin, editer, viewer)
  - **Session Management**: Cookie bases session management
  - **Automatic Redirects**: Automatic redircts to authentication service and back

## API Gateway
  - Recieves incoming HTTP requests
  - Checks authentication and authorization before routing to microservices
  - Users not mapped get the default role of Viewer
  - Error handling for unauthenticated/unauthorized users
  - Handles user sessions using cookies
  - Logs all requests for debugging and tracing

## Read Service 
  - Implements GET requests on the chatbot database (/chatbot?question=<question>)
  - Querys the database for a matching response
  - Returns "Not able to understand you" for unmatched questions
  - Required role: Viewer, Editor, Admin

## Create Service
  - Adds new questions & answers using POST (/create)
  - Sent with a JSON body
    {
      "question": "new question",
      "reply": "corresponding reply"
    }
  - Does not allow duplicate entries
  - Required role: Admin

## Update Service 
  - Modifies existing entries using PUT (/update/api/hints/:id)
  - Sent with a JSON 
    {
      "question": "new question",
      "reply": "new reply"
    }
  - Required role: Editor, Admin

## Delete Service
  - Deletes an entry from the databse (/delete/api/hints/:id)
  - Required role: Admin

## Tech Stack
  - **Runtime** Node.js 18 (Alpine)
    
  - **Framework** Express.js
    
  - **Authentication**
    - cas-authentication (VT CAS)
    - jsonwebtoken
    - express-session
      
  - **Proxy** http-proxy-middleware
    
  - **Security**
    - helmet
    - cors
    - cookie-parser
      
  - **Database**
    - MySQL
    - Schema: chatbot_hints table (id, question, reply)
      
  - **Infrastructure**
    - **Containerization**: Docker
    - **Orchestration**: Kubernetes (Rancher)
    - **Registry**: Gitlab container registry
    - **Ingress**: Nginx Ingress Controller
    - **Service Type**: ClusterIP
    - 
  - **Development Tools**
    - **Logging**: Morgan
    - **Process Manager**: Nodemon
    - **Version Control**: Git


    
