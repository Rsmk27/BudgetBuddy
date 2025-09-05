// script.js

// --- DOM Elements ---
const addExpenseForm = document.getElementById('add-expense-form');
const expenseTitleInput = document.getElementById('expense-title');
const expenseAmountInput = document.getElementById('expense-amount');
const expenseCategorySelect = document.getElementById('expense-category');
const expenseDateInput = document.getElementById('expense-date');
const expenseListBody = document.getElementById('expense-list');
const totalExpensesSpan = document.getElementById('total-expenses');
const dailyExpensesSpan = document.getElementById('daily-expenses');
const weeklyExpensesSpan = document.getElementById('weekly-expenses');
const monthlyExpensesSpan = document.getElementById('monthly-expenses');
const categoryBreakdownDiv = document.getElementById('category-breakdown');
const spendingChartCanvas = document.getElementById('spending-chart');
const chartNoDataMessage = document.getElementById('chart-no-data');
const filterCategorySelect = document.getElementById('filter-category');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const applyDateFilterBtn = document.getElementById('apply-date-filter');
const exportCsvBtn = document.getElementById('export-csv');
const exportJsonBtn = document.getElementById('export-json');
const darkModeToggleHeader = document.getElementById('dark-mode-toggle');
const darkModeToggleSettings = document.getElementById('dark-mode-toggle-settings');
const resetDataBtn = document.getElementById('reset-data');
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');
const budgetGoalInput = document.getElementById('budget-goal');
const budgetWarningText = document.getElementById('budget-warning');
const messageBox = document.getElementById('message-box');

// NEW AUTH ELEMENTS
const authSection = document.getElementById('auth-section');
const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authModeToggle = document.getElementById('auth-mode-toggle');
const authTitle = document.getElementById('auth-title');
const authMessage = document.getElementById('auth-message');
const mainContent = document.querySelector('main');
const logoutBtn = document.getElementById('logout-btn');

// --- Global Variables ---
let expenses = [];
let spendingChart; // To hold the Chart.js instance
let isLoginMode = true; // State for login/signup form
let currentUser = null;
const db = firebase.firestore();

// --- Utility Functions ---

/**
 * Displays a temporary message box to the user.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('success', 'error', 'warning').
 */
function showMessageBox(message, type, element = messageBox) {
    element.textContent = message;
    element.className = `message-box show ${type}`;
    setTimeout(() => {
        element.classList.remove('show');
    }, 3000);
}

/**
 * Formats a number as currency.
 * @param {number} amount - The amount to format.
 * @returns {string} - Formatted currency string.
 */
function formatCurrency(amount) {
    return `₹${amount.toFixed(2)}`;
}

/**
 * Generates a unique ID for an expense.
 * @returns {string} - A unique ID.
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// --- Firebase Authentication Functions ---

authModeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.textContent = "Log In";
        authSubmitBtn.textContent = "Log In";
        authModeToggle.textContent = "Sign Up";
        authModeToggleText.textContent = "Don't have an account?";
    } else {
        authTitle.textContent = "Sign Up";
        authSubmitBtn.textContent = "Sign Up";
        authModeToggle.textContent = "Log In";
        authModeToggleText.textContent = "Already have an account?";
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmailInput.value;
    const password = authPasswordInput.value;

    try {
        if (isLoginMode) {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            showMessageBox("Logged in successfully!", "success", authMessage);
        } else {
            await firebase.auth().createUserWithEmailAndPassword(email, password);
            showMessageBox("Account created successfully! You are now logged in.", "success", authMessage);
        }
    } catch (error) {
        let errorMessage;
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = "Invalid email address.";
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = "Invalid email or password.";
                break;
            case 'auth/email-already-in-use':
                errorMessage = "Email is already in use.";
                break;
            case 'auth/weak-password':
                errorMessage = "Password should be at least 6 characters.";
                break;
            default:
                errorMessage = "An error occurred. Please try again.";
        }
        showMessageBox(errorMessage, "error", authMessage);
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await firebase.auth().signOut();
        showMessageBox("Logged out successfully!", "success");
    } catch (error) {
        showMessageBox("Failed to log out. Please try again.", "error");
    }
});

// --- Firebase Data Management ---

async function fetchExpenses() {
    if (!currentUser) return;

    try {
        // Fetch expenses from the user's specific collection
        const docRef = db.collection('users').doc(currentUser.uid).collection('data').doc('expenses');
        const doc = await docRef.get();

        if (doc.exists) {
            expenses = doc.data().list;
            // Ensure amounts are numbers
            expenses.forEach(exp => exp.amount = parseFloat(exp.amount));
        } else {
            expenses = [];
            console.log("No expenses found for this user.");
        }
    } catch (error) {
        console.error("Error fetching expenses: ", error);
        showMessageBox("Failed to load data. Please try refreshing.", "error");
        expenses = [];
    }
    renderExpenses();
    checkBudget();
}

async function saveExpenses() {
    if (!currentUser) return;

    try {
        // Save the entire expenses array to a single document
        const expensesRef = db.collection('users').doc(currentUser.uid).collection('data').doc('expenses');
        await expensesRef.set({ list: expenses });
    } catch (error) {
        console.error("Error saving expenses: ", error);
        showMessageBox("Failed to save data. Please try again.", "error");
    }
}

async function fetchBudgetGoal() {
    if (!currentUser) return;
    try {
        const docRef = db.collection('users').doc(currentUser.uid).collection('data').doc('settings');
        const doc = await docRef.get();
        if (doc.exists && doc.data().budgetGoal) {
            budgetGoalInput.value = doc.data().budgetGoal;
        }
    } catch (error) {
        console.error("Error fetching budget goal: ", error);
    }
}

async function saveBudgetGoal() {
    if (!currentUser) return;
    try {
        const goal = parseFloat(budgetGoalInput.value);
        if (!isNaN(goal) && goal > 0) {
            const settingsRef = db.collection('users').doc(currentUser.uid).collection('data').doc('settings');
            await settingsRef.set({ budgetGoal: goal }, { merge: true });
        }
    } catch (error) {
        console.error("Error saving budget goal: ", error);
    }
}

/**
 * Adds a new expense.
 * @param {Event} event - The form submission event.
 */
async function addExpense(event) {
    event.preventDefault();

    const title = expenseTitleInput.value.trim();
    const amount = parseFloat(expenseAmountInput.value);
    const category = expenseCategorySelect.value;
    const date = expenseDateInput.value;

    if (!title || isNaN(amount) || amount <= 0 || !category || !date) {
        showMessageBox("Please fill in all fields correctly.", "error");
        return;
    }

    const newExpense = {
        id: generateUniqueId(),
        title,
        amount,
        category,
        date
    };

    expenses.push(newExpense);
    await saveExpenses();
    renderExpenses();
    checkBudget();
    showMessageBox("Expense added successfully!", "success");

    addExpenseForm.reset();
    expenseDateInput.valueAsDate = new Date();
}

/**
 * Deletes an expense by its ID.
 * @param {string} id - The ID of the expense to delete.
 */
async function deleteExpense(id) {
    const confirmDelete = confirm("Are you sure you want to delete this expense?");
    if (!confirmDelete) {
        return;
    }

    expenses = expenses.filter(expense => expense.id !== id);
    await saveExpenses();
    renderExpenses();
    checkBudget();
    showMessageBox("Expense deleted.", "warning");
}

/**
 * Renders the expenses in the table and updates all summary sections and chart.
 */
function renderExpenses() {
    const filterCategory = filterCategorySelect.value;
    const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
    const endDate = endDateInput.value ? new Date(endDateInput.value) : null;

    const filteredExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const matchesCategory = filterCategory === 'all' || expense.category === filterCategory;
        const matchesStartDate = !startDate || expenseDate >= startDate;
        const matchesEndDate = !endDate || expenseDate <= endDate;
        return matchesCategory && matchesStartDate && matchesEndDate;
    });

    expenseListBody.innerHTML = '';

    if (filteredExpenses.length === 0) {
        expenseListBody.innerHTML = '<tr><td colspan="5" class="no-data-message">No expenses found for the selected filters.</td></tr>';
    } else {
        filteredExpenses.forEach(expense => {
            const row = document.createElement('tr');
            row.classList.add('animate__popIn');
            row.innerHTML = `
                <td>${expense.title}</td>
                <td>${expense.category}</td>
                <td>${formatCurrency(expense.amount)}</td>
                <td>${expense.date}</td>
                <td>
                    <button class="delete-btn" data-id="${expense.id}" aria-label="Delete expense">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            expenseListBody.appendChild(row);
        });
    }

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.onclick = (e) => deleteExpense(e.currentTarget.dataset.id);
    });

    updateSummary(expenses);
    updateChart(expenses);
}

// All other functions (`updateSummary`, `initChart`, `updateChart`, etc.) remain the same.

// --- Dark Mode, Export, and Other Functions (keep as is) ---
function loadDarkModePreference() {
    try {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            darkModeToggleHeader.querySelector('i').classList.replace('fa-moon', 'fa-sun');
            darkModeToggleSettings.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            darkModeToggleHeader.querySelector('i').classList.replace('fa-sun', 'fa-moon');
            darkModeToggleSettings.checked = false;
        }
    } catch (e) {
        console.error("Error loading dark mode preference:", e);
    }
}

function saveDarkModePreference(isDarkMode) {
    try {
        localStorage.setItem('darkMode', isDarkMode);
    } catch (e) {
        console.error("Error saving dark mode preference:", e);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    saveDarkModePreference(isDarkMode);
    const icon = darkModeToggleHeader.querySelector('i');
    if (isDarkMode) {
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        icon.classList.replace('fa-sun', 'fa-moon');
    }
    darkModeToggleSettings.checked = isDarkMode;
    if (spendingChart) {
        spendingChart.options.plugins.legend.labels.color = getComputedStyle(document.body).getPropertyValue('--text-color-light');
        spendingChart.update();
    }
}

function updateSummary(currentExpenses) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    let total = 0;
    let daily = 0;
    let weekly = 0;
    let monthly = 0;
    const categoryTotals = {};

    currentExpenses.forEach(expense => {
        const expenseDate = new Date(expense.date);
        expenseDate.setHours(0, 0, 0, 0);

        total += expense.amount;

        if (expenseDate.getTime() === today.getTime()) {
            daily += expense.amount;
        }
        if (expenseDate >= startOfWeek) {
            weekly += expense.amount;
        }
        if (expenseDate >= startOfMonth) {
            monthly += expense.amount;
        }

        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    totalExpensesSpan.textContent = formatCurrency(total);
    dailyExpensesSpan.textContent = formatCurrency(daily);
    weeklyExpensesSpan.textContent = formatCurrency(weekly);
    monthlyExpensesSpan.textContent = formatCurrency(monthly);

    categoryBreakdownDiv.innerHTML = '';
    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

    if (sortedCategories.length === 0) {
        categoryBreakdownDiv.innerHTML = '<p class="no-data-message">No expenses yet. Add some to see your breakdown!</p>';
    } else {
        sortedCategories.forEach(([category, amount]) => {
            const div = document.createElement('div');
            div.innerHTML = `<span>${category}:</span> <span>${formatCurrency(amount)}</span>`;
            categoryBreakdownDiv.appendChild(div);
        });
    }
}

function initChart() {
    const ctx = spendingChartCanvas.getContext('2d');
    spendingChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#4CAF50', '#81C784', '#FFD54F', '#64B5F6', '#9575CD',
                    '#FF8A65', '#A1887F', '#E0E0E0', '#795548', '#B0BEC5'
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-color-light'),
                        font: {
                            family: 'Poppins'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += formatCurrency(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

function updateChart(currentExpenses) {
    const categoryTotals = {};
    currentExpenses.forEach(expense => {
        categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    if (labels.length === 0) {
        spendingChartCanvas.style.display = 'none';
        chartNoDataMessage.style.display = 'block';
    } else {
        spendingChartCanvas.style.display = 'block';
        chartNoDataMessage.style.display = 'none';
    }

    spendingChart.data.labels = labels;
    spendingChart.data.datasets[0].data = data;
    spendingChart.update();
}

function applyFilters() {
    renderExpenses();
}

function exportCSV() {
    if (expenses.length === 0) {
        showMessageBox("No data to export.", "warning");
        return;
    }
    let csvContent = "Title,Category,Amount,Date\n";
    expenses.forEach(expense => {
        csvContent += `${expense.title},${expense.category},${expense.amount},${expense.date}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'budgetbuddy_expenses.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessageBox("Expenses exported as CSV!", "success");
}

function exportJSON() {
    if (expenses.length === 0) {
        showMessageBox("No data to export.", "warning");
        return;
    }
    const jsonContent = JSON.stringify(expenses, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'budgetbuddy_expenses.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessageBox("Expenses exported as JSON!", "success");
}

function checkBudget() {
    const budgetGoal = parseFloat(budgetGoalInput.value);
    if (isNaN(budgetGoal) || budgetGoal <= 0) {
        budgetWarningText.textContent = '';
        return;
    }
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    let currentMonthlySpending = 0;
    expenses.forEach(expense => {
        const expenseDate = new Date(expense.date);
        expenseDate.setHours(0, 0, 0, 0);
        if (expenseDate >= startOfMonth) {
            currentMonthlySpending += expense.amount;
        }
    });
    if (currentMonthlySpending > budgetGoal) {
        budgetWarningText.textContent = `Warning: You are ${formatCurrency(currentMonthlySpending - budgetGoal)} over your monthly budget goal of ${formatCurrency(budgetGoal)}!`;
        budgetWarningText.classList.add('warning-text');
    } else {
        budgetWarningText.textContent = `You have ${formatCurrency(budgetGoal - currentMonthlySpending)} remaining in your monthly budget.`;
        budgetWarningText.classList.remove('warning-text');
    }
}

async function resetAllData() {
    const confirmReset = confirm("Are you sure you want to reset ALL your data? This action cannot be undone.");
    if (!confirmReset) return;

    if (currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid).collection('data').doc('expenses').delete();
            await db.collection('users').doc(currentUser.uid).collection('data').doc('settings').delete();
            showMessageBox("All data has been reset.", "success");
        } catch (error) {
            showMessageBox("Failed to reset data. Please try again.", "error");
            return;
        }
    }

    expenses = [];
    budgetGoalInput.value = '';
    budgetWarningText.textContent = '';
    renderExpenses();
}

function handleNavigation(event) {
    event.preventDefault();
    const targetSectionId = event.currentTarget.dataset.section;
    navLinks.forEach(link => link.classList.remove('active'));
    sections.forEach(section => {
        section.classList.remove('active');
        section.classList.remove('animate__fadeInUp');
    });
    event.currentTarget.classList.add('active');
    const targetSection = document.getElementById(targetSectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.classList.add('animate__fadeInUp');
    }
}

// --- Initialization & Event Listeners ---
function initApp() {
    // Firebase Auth State Listener
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            currentUser = user;
            authSection.style.display = 'none';
            mainContent.style.display = 'block';
            logoutBtn.style.display = 'inline-flex';
            
            navLinks.forEach(link => link.addEventListener('click', handleNavigation));
            document.querySelector('.nav-link[data-section="dashboard"]').click(); // Show dashboard on login

            // Load user-specific data from Firestore
            await fetchExpenses();
            await fetchBudgetGoal();
        } else {
            // User is signed out
            currentUser = null;
            authSection.style.display = 'block';
            mainContent.style.display = 'none';
            logoutBtn.style.display = 'none';
        }
    });

    // Attach event listeners for app features
    addExpenseForm.addEventListener('submit', addExpense);
    filterCategorySelect.addEventListener('change', applyFilters);
    applyDateFilterBtn.addEventListener('click', applyFilters);
    exportCsvBtn.addEventListener('click', exportCSV);
    exportJsonBtn.addEventListener('click', exportJSON);
    darkModeToggleHeader.addEventListener('click', toggleDarkMode);
    darkModeToggleSettings.addEventListener('change', toggleDarkMode);
    resetDataBtn.addEventListener('click', resetAllData);
    budgetGoalInput.addEventListener('input', saveBudgetGoal);
    budgetGoalInput.addEventListener('input', checkBudget);
    
    // Initial setup
    loadDarkModePreference();
    initChart();
    expenseDateInput.valueAsDate = new Date();
}

document.addEventListener('DOMContentLoaded', initApp);
