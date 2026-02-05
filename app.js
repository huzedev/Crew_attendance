const form = document.getElementById("student-form");
const nameInput = document.getElementById("student-name");
const classInput = document.getElementById("student-class");
const tableBody = document.getElementById("student-table");
const bulkButtons = document.querySelectorAll("[data-bulk]");
const recordTemplate = document.getElementById("record-template");

const STATUS_LABELS = {
  present: "present",
  late: "late",
  unexcused: "unexcused",
  excused: "excused",
};

let students = [];

async function fetchStudents() {
  const response = await fetch("/api/students");
  if (!response.ok) {
    throw new Error("Failed to load students.");
  }
  return response.json();
}

async function createStudent(payload) {
  const response = await fetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to add student.");
  }
  return response.json();
}

async function updateStatus(studentId, status, note) {
  const response = await fetch(`/api/students/${studentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
  if (!response.ok) {
    throw new Error("Failed to update status.");
  }
  return response.json();
}

async function bulkUpdate(status) {
  const response = await fetch("/api/students/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error("Failed to bulk update.");
  }
  return response.json();
}

function createStatusPill(status) {
  const span = document.createElement("span");
  span.className = `status-pill status-${status}`;
  span.textContent = STATUS_LABELS[status];
  return span;
}

function renderTable() {
  tableBody.innerHTML = "";
  if (!students.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td class="empty-state" colspan="5">No students added yet. Use the form above to get started.</td>`;
    tableBody.appendChild(emptyRow);
    return;
  }

  students.forEach((student) => {
    const row = document.createElement("tr");
    const statusCell = document.createElement("td");
    const select = document.createElement("select");
    Object.keys(STATUS_LABELS).forEach((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = STATUS_LABELS[key];
      if (student.status === key) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    select.addEventListener("change", async () => {
      try {
        const updated = await updateStatus(student.id, select.value, "Status updated");
        students = students.map((item) => (item.id === updated.id ? updated : item));
        renderTable();
      } catch (error) {
        console.error(error);
      }
    });

    statusCell.appendChild(createStatusPill(student.status));
    statusCell.appendChild(select);
    statusCell.classList.add("status-cell");

    row.innerHTML = `
      <td>${student.name}</td>
      <td>${student.dreamClass}</td>
      <td></td>
      <td>${student.lastUpdated || "--"}</td>
      <td></td>
    `;

    row.children[2].appendChild(statusCell);

    const recordCell = row.children[4];
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "record-toggle";
    toggleButton.textContent = `View records (${student.records.length})`;

    const recordList = document.createElement("div");
    recordList.className = "record-list";
    recordList.hidden = true;

    student.records.forEach((record) => {
      const recordNode = recordTemplate.content.cloneNode(true);
      recordNode.querySelector(".record-meta").textContent = `${record.timestamp} · ${record.status}`;
      recordNode.querySelector(".record-note").textContent = record.note;
      recordList.appendChild(recordNode);
    });

    toggleButton.addEventListener("click", () => {
      recordList.hidden = !recordList.hidden;
      toggleButton.textContent = recordList.hidden
        ? `View records (${student.records.length})`
        : "Hide records";
    });

    recordCell.appendChild(toggleButton);
    recordCell.appendChild(recordList);

    tableBody.appendChild(row);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  const dreamClass = classInput.value.trim();
  if (!name || !dreamClass) {
    return;
  }

  try {
    const newStudent = await createStudent({
      id: crypto.randomUUID(),
      name,
      dreamClass,
    });
    students = [newStudent, ...students];
    renderTable();
    form.reset();
    nameInput.focus();
  } catch (error) {
    console.error(error);
  }
});

bulkButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      students = await bulkUpdate(button.dataset.bulk);
      renderTable();
    } catch (error) {
      console.error(error);
    }
  });
});

(async () => {
  try {
    students = await fetchStudents();
    renderTable();
  } catch (error) {
    console.error(error);
  }
})();
