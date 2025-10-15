# ClubRRRR Management System

## מערכת ניהול מקצועית למכללת נדל"ן

### ארכיטקטורה
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Redis
- **Real-time**: Socket.io
- **Authentication**: JWT + Refresh Tokens

### מודולים עיקריים
1. CRM - ניהול לידים ועסקאות
2. Courses - ניהול מחזורים ותלמידים
3. Calendar/Gantt - לוח שנה ותכנון
4. Tasks - ניהול משימות
5. Finance - ניהול פיננסי
6. Students Portal - פורטל תלמידים

### הרצה מקומית
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm start
```

### Deployment
המערכת מוכנה ל-deployment על:
- AWS / Google Cloud / Azure
- Docker containers
- Kubernetes (עבור scale)
