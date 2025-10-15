-- ClubRRRR Database Schema
-- PostgreSQL 14+

-- ============================================
-- 1. USERS & AUTHENTICATION
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'student');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'student',
    status user_status NOT NULL DEFAULT 'active',
    avatar_url TEXT,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. CRM - LEADS & CUSTOMERS
-- ============================================

CREATE TYPE lead_status AS ENUM (
    'new', 'contacted', 'interested', 'negotiating', 
    'closed_won', 'closed_lost', 'not_relevant'
);

CREATE TYPE lead_source AS ENUM (
    'facebook', 'instagram', 'tiktok', 'youtube', 
    'referral', 'website', 'webinar', 'other'
);

CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    source lead_source NOT NULL,
    status lead_status NOT NULL DEFAULT 'new',
    interested_program VARCHAR(100),
    assigned_to INTEGER REFERENCES users(id),
    notes TEXT,
    next_follow_up DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lead_activities (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    activity_type VARCHAR(50) NOT NULL, -- call, email, meeting, note
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deals (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id),
    program_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    stage VARCHAR(50) NOT NULL, -- proposal, negotiation, contract, payment
    assigned_to INTEGER REFERENCES users(id),
    expected_close_date DATE,
    actual_close_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. PROGRAMS & COURSES
-- ============================================

CREATE TYPE program_type AS ENUM ('clubber360', 'mentoring', 'other');
CREATE TYPE cycle_status AS ENUM ('planned', 'active', 'completed', 'cancelled');

CREATE TABLE programs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type program_type NOT NULL,
    description TEXT,
    duration_weeks INTEGER NOT NULL,
    price DECIMAL(10,2),
    max_students INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cycles (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES programs(id),
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status cycle_status NOT NULL DEFAULT 'planned',
    max_students INTEGER,
    current_students INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    cycle_id INTEGER REFERENCES cycles(id),
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, dropped
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, partial
    total_paid DECIMAL(10,2) DEFAULT 0,
    notes TEXT
);

-- ============================================
-- 4. CALENDAR & EVENTS
-- ============================================

CREATE TYPE event_type AS ENUM ('qa_session', 'practice', 'webinar', 'meeting', 'other');

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    type event_type NOT NULL,
    cycle_id INTEGER REFERENCES cycles(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location VARCHAR(255),
    meeting_link TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_attendees (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'invited', -- invited, confirmed, attended, absent
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. TASKS & PROJECT MANAGEMENT
-- ============================================

CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    assigned_to INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    event_id INTEGER REFERENCES events(id),
    cycle_id INTEGER REFERENCES cycles(id),
    due_date DATE,
    completed_at TIMESTAMP,
    parent_task_id INTEGER REFERENCES tasks(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_attachments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. FINANCE
-- ============================================

CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE payment_method AS ENUM ('credit_card', 'bank_transfer', 'bit', 'paypal', 'cash');

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method payment_method,
    is_recurring BOOLEAN DEFAULT false,
    recurring_day INTEGER, -- day of month for recurring expenses
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE income (
    id SERIAL PRIMARY KEY,
    source VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    income_date DATE NOT NULL,
    payment_method payment_method,
    enrollment_id INTEGER REFERENCES enrollments(id),
    deal_id INTEGER REFERENCES deals(id),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. NOTIFICATIONS & MESSAGES
-- ============================================

CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'error');

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type notification_type NOT NULL DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. SYSTEM LOGS & AUDIT
-- ============================================

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES for Performance
-- ============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- Leads
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_created ON leads(created_at);

-- Cycles
CREATE INDEX idx_cycles_program ON cycles(program_id);
CREATE INDEX idx_cycles_status ON cycles(status);
CREATE INDEX idx_cycles_dates ON cycles(start_date, end_date);

-- Events
CREATE INDEX idx_events_cycle ON events(cycle_id);
CREATE INDEX idx_events_time ON events(start_time);
CREATE INDEX idx_events_type ON events(type);

-- Tasks
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Finance
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_income_date ON income(income_date);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ============================================
-- Initial Data
-- ============================================

-- Insert default programs
INSERT INTO programs (name, type, duration_weeks, price, max_students) VALUES
('קלאבר 360', 'clubber360', 10, 3000.00, 50),
('מנטורינג', 'mentoring', 6, 1800.00, 20);

-- Insert default admin user (password: Admin123!)
-- You should change this password immediately after first login
INSERT INTO users (email, password_hash, first_name, last_name, role, status) VALUES
('admin@clubrrrr.com', '$2a$10$rU8kWZjPl4XqXGVvhPZpEeqVqB7qM4FJXEYq3YrTJZOGP6rXvN8eO', 'Admin', 'User', 'admin', 'active');

-- ============================================
-- Functions & Triggers
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cycles_updated_at BEFORE UPDATE ON cycles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update cycle student count
CREATE OR REPLACE FUNCTION update_cycle_student_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE cycles SET current_students = current_students + 1 
        WHERE id = NEW.cycle_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE cycles SET current_students = current_students - 1 
        WHERE id = OLD.cycle_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cycle_count AFTER INSERT OR DELETE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_cycle_student_count();
