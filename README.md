# 🏰 Aqar Real Estate Management System

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)

> A high-performance, secure, and scalable real estate management platform built with modern Node.js technologies.

## 📖 Overview

**Aqar** is a robust real estate management solution designed to bridge the gap between property developers and potential buyers. It provides a seamless experience for managing property units, residential projects, and company news, all powered by a custom-built, high-performance secure flat-file database system.

The system features a dual-interface architecture:
1.  **Public Portal**: A responsive frontend for users to browse properties, view project details, and contact agents.
2.  **Admin Dashboard**: A secure, role-based control panel for managing content, analyzing traffic, and handling user interactions.

## ✨ Key Features

### 🏢 Property Management
-   **Unit Cataloging**: Detailed management of residential and commercial units with specifications (area, price, location).
-   **Project Portfolios**: Group units into larger development projects.
-   **Advanced Filtering**: Search capabilities by price range, location, and unit type.

### 🔐 Security & Performance
-   **Secure Flat-File Database**: Custom-engineered JSON storage system with sharding capability for high performance without SQL overhead.
-   **Enterprise-Grade Security**: Implements `Helmet`, input sanitization, NoSQL injection prevention, and strict CORS policies.
-   **JWT Authentication**: Secure, stateless session management for administrative access.
-   **Intellectual Cache**: In-memory caching layer to reduce I/O operations and speed up public API response times.

### 📊 Administrative Tools
-   **Dashboard Analytics**: Real-time overview of system status and visitor metrics.
-   **Content Management**: intuitive editors for News, Projects, and Units.
-   **Secure Media Handling**: Integrated file upload system using `Multer` with validation.

## 🛠️ Technology Stack

-   **Runtime**: [Node.js](https://nodejs.org/) (v18+)
-   **Framework**: [Express.js](https://expressjs.com/)
-   **Security**: Helmet, bcryptjs, JWT, CORS
-   **Data Storage**: Custom Sharded JSON System (NoSQL-like)
-   **File Handling**: Multer
-   **Frontend**: HTML5, CSS3, Vanilla JavaScript (Design-First approach)

## 📂 Project Structure

```bash
aqar/
├── admin/              # Admin dashboard HTML/CSS/JS
├── controllers/        # Business logic handlers
├── lib/                # Core libraries (Security, Logger, Data Service)
├── middleware/         # Auth, Cache, and Validation middleware
├── public/             # Public-facing website files
├── routes/             # API route definitions
├── secure_data/        # Encrypted/Protected JSON data storage (Ignored in Git)
├── server.js           # Application entry point
└── tests/              # Automated test suites
```

## 🚀 Getting Started

### Prerequisites
-   Node.js v18 or higher
-   npm or yarn

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/AhmedKhalid0/aqar.git
    cd aqar
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env` file in the root directory (optional for dev, required for prod):
    ```env
    PORT=3000
    JWT_SECRET=your_super_secure_secret_key_here
    NODE_ENV=development
    ```

4.  **Initialize Data Structure**
    The system will automatically generate the `secure_data` folder structure upon first launch.

5.  **Start the Server**
    ```bash
    # Development Mode
    npm run dev

    # Production Mode
    npm start
    ```

## 📦 Deployment

### Using PM2 (Recommended)

1.  Install PM2 globally:
    ```bash
    npm install -g pm2
    ```

2.  Start the application:
    ```bash
    pm2 start ecosystem.config.js
    ```

3.  Monitor the process:
    ```bash
    pm2 monit
    ```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ by the Aqar Development Team*
