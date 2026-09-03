# Nexus Scheduler

A browser-based task scheduler and dependency pipeline manager for organizing work, tracking progress, and visualizing task order.

Live demo: https://z3yad30.github.io/task-scheduler/

## What this project does

Nexus Scheduler helps you:

- Create tasks with names, priorities, deadlines, descriptions, and links
- Add dependency relationships between tasks
- Track task status as Not Started, In Progress, or Completed
- View tasks in a pipeline layout ordered by execution flow
- Switch to a dependency graph view for visual planning
- Detect circular dependencies and validate task ordering
- Run sorting tools such as topological sort, priority sort, and deadline sort
- Save and manage tasks using a cloud-backed API while keeping the session active in the browser

This project is designed for planning workflows where one task depends on another and you want to see what must happen first.

## Main features

### Task management
- Add tasks from the New Task panel
- Set task dependencies by selecting other tasks
- Assign a priority from 0 to 10
- Add a deadline and description
- Attach external links to each task

### Status tracking
- Mark tasks as:
  - Not Started
  - In Progress
  - Completed
- Updates reflect in both the task list and pipeline view

### Pipeline view
- Shows tasks in execution order
- Highlights blocked tasks whose dependencies are not complete
- Displays task priority, deadline, and link information

### Graph view
- Visualizes the dependency network with an interactive graph
- Lets you click a node to inspect a task
- Includes zoom and fit controls

### Analysis tools
- Detect cycles in the dependency graph
- Compute a topological sort
- Sort tasks by priority
- Sort tasks by deadline

## How to use it

### 1. Open the app

You can use the live version here:

https://z3yad30.github.io/task-scheduler/

Or run it locally from your machine.

### 2. Sign in or register

On first use:

- Enter a username and password
- Click Register Account if you do not already have one
- Sign in with your account afterward

### 3. Create a task

Click the New Task button.

Fill in:
- Task name
- Dependencies (optional)
- Priority
- Deadline
- Description
- Links

Then submit the form.

### 4. Manage tasks

From the task list or pipeline view:
- Open a task to view details
- Edit the task
- Update its status
- Delete it when needed

### 5. Toggle views

Use the top button to switch between:
- Pipeline view
- Graph view

### 6. Analyze your workflow

Use the analytics buttons to:
- Detect cycles
- View topological order
- Sort by priority
- Sort by deadline
- Clear the output console

## Local development

### Option 1: Open directly in browser

Because this is a simple front-end project, you can usually run it by opening the index.html file directly in a browser.

### Option 2: Run a local server

From the project folder, run:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

This is often the easiest way to avoid browser restrictions when working with local files.

## Project structure

- index.html — app layout and UI structure
- style.css — styling and responsive layout
- app.js — task logic, rendering, dependency handling, sorting, and API calls

## Notes

- The app uses a remote mock API for saving tasks and user accounts.
- The browser stores the current user session and theme locally.
- If a cycle is present, the scheduler will fall back to priority ordering instead of a valid topological order.

## License

This project is provided as a small frontend demo and can be used or modified freely for learning and personal projects.
