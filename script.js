let db

// === ИНИЦИАЛИЗАЦИЯ БАЗЫ ===
const request = indexedDB.open('GroupsTasksDB', 1)

request.onerror = () => console.error('Ошибка при открытии базы данных')

request.onupgradeneeded = event => {
    db = event.target.result
    const groupStore = db.createObjectStore('groups', { keyPath: 'id' })
    groupStore.createIndex('id', 'id', { unique: true })
}

request.onsuccess = event => {
    db = event.target.result
    loadGroupsFromDB()
}

// === ФУНКЦИИ РАБОТЫ С БД ===
function saveGroupToDB(group) {
    const tx = db.transaction('groups', 'readwrite')
    tx.objectStore('groups').put(group)
}

function deleteGroupFromDB(id) {
    const tx = db.transaction('groups', 'readwrite')
    tx.objectStore('groups').delete(id)
}

function updateGroupTitle(id, newTitle) {
    const tx = db.transaction('groups', 'readwrite')
    const store = tx.objectStore('groups')
    const request = store.get(id)

    request.onsuccess = () => {
        const group = request.result
        group.title = newTitle
        store.put(group)
    }
}

function addTaskToGroup(groupId, task) {
    const tx = db.transaction('groups', 'readwrite')
    const store = tx.objectStore('groups')
    const request = store.get(groupId)

    request.onsuccess = () => {
        const group = request.result
        group.tasks.push(task)
        store.put(group)
    }
}

function removeTaskFromGroup(groupId, taskId) {
    const tx = db.transaction('groups', 'readwrite')
    const store = tx.objectStore('groups')
    const request = store.get(groupId)

    request.onsuccess = () => {
        const group = request.result
        group.tasks = group.tasks.filter(t => t.id !== taskId)
        store.put(group)
    }
}

function loadGroupsFromDB() {
    const tx = db.transaction('groups', 'readonly')
    const store = tx.objectStore('groups')
    const request = store.getAll()

    request.onsuccess = () => {
        request.result.forEach(renderGroup)
    }
}

// === РЕНДЕРИНГ ===
function renderGroup(group) {
    const html = `
        <div class="group" data-id="${group.id}">
            <div class="group_title">
                <span>${group.title}</span>
                <button class="group_delete">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                </button>
            </div>
            <div class="group_content">
                <div class="group_tasks">
                    ${group.tasks.map(t => `
                        <div class="task task-${t.id}">
                            <span>${t.title}</span>
                            <time>${t.date}</time>
                        </div>
                    `).join('')}
                </div>
                <button class="create_task">Создать задачу</button>
            </div>
        </div>
    `
    document.querySelector('.column_groups').insertAdjacentHTML('beforeend', html)
}

// === СОЗДАНИЕ ГРУППЫ ===
document.querySelector('.create_group').addEventListener('click', () => {
    const id = Date.now().toString()
    const group = {
        id,
        title: 'Новая группа',
        tasks: []
    }
    saveGroupToDB(group)
    renderGroup(group)
})

// === УДАЛЕНИЕ ГРУППЫ ===
document.addEventListener('click', e => {
    if (e.target.closest('.group_delete')) {
        const group = e.target.closest('.group')
        const id = group.dataset.id
        deleteGroupFromDB(id)
        group.remove()
    }
})

// === СОЗДАНИЕ ЗАДАЧИ ===
document.addEventListener('click', e => {
    if (e.target.classList.contains('create_task')) {
        const groupEl = e.target.closest('.group')
        const groupId = groupEl.dataset.id
        const groupTasks = groupEl.querySelector('.group_tasks')

        const taskId = Date.now()
        const today = new Date()
        const formattedDate = today.toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: '2-digit'
        }).replace(/\./g, '.')

        const task = {
            id: taskId,
            title: 'Новая задача',
            date: formattedDate
        }

        addTaskToGroup(groupId, task)

        const taskHTML = `
            <div class="task task-${taskId}">
                <span>${task.title}</span>
                <time>${task.date}</time>
            </div>
        `
        groupTasks.insertAdjacentHTML('beforeend', taskHTML)
    }
})

// === РЕДАКТИРОВАНИЕ ГРУППЫ / ЗАДАЧИ ===
document.addEventListener('contextmenu', function(e) {
    if (e.target.matches('.group_title span') || e.target.matches('.task span')) {
        e.preventDefault()
        const span = e.target
        span.contentEditable = true
        span.focus()

        const range = document.createRange()
        range.selectNodeContents(span)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)

        function finish() {
            span.contentEditable = false
            document.removeEventListener('keydown', onKeyDown)
            span.removeEventListener('blur', finish)

            if (span.closest('.group_title')) {
                const group = span.closest('.group')
                updateGroupTitle(group.dataset.id, span.textContent)
            } else if (span.closest('.task')) {
                const taskEl = span.closest('.task')
                const taskId = +taskEl.className.match(/task-(\d+)/)[1]
                const groupId = span.closest('.group').dataset.id

                const tx = db.transaction('groups', 'readwrite')
                const store = tx.objectStore('groups')
                const request = store.get(groupId)

                request.onsuccess = () => {
                    const group = request.result
                    const task = group.tasks.find(t => t.id === taskId)
                    if (task) {
                        task.title = span.textContent
                        store.put(group)
                    }
                }
            }
        }

        function onKeyDown(e) {
            if (e.key === 'Enter') {
                e.preventDefault()
                finish()
            }
        }

        document.addEventListener('keydown', onKeyDown)
        span.addEventListener('blur', finish)
    }
})

// === УДАЛЕНИЕ ЗАДАЧИ ===
document.addEventListener('dblclick', e => {
    if (e.target.matches('.task span')) {
        const taskEl = e.target.closest('.task')
        const groupId = e.target.closest('.group').dataset.id
        const taskId = +taskEl.className.match(/task-(\d+)/)[1]

        removeTaskFromGroup(groupId, taskId)
        taskEl.remove()
    }
})
