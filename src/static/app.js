document.addEventListener("DOMContentLoaded", () => {
  const roleSelect = document.getElementById("role");
  const actorEmailInput = document.getElementById("actor-email");
  const modeMessage = document.getElementById("mode-message");
  const loadDashboardButton = document.getElementById("load-dashboard");
  const dashboardList = document.getElementById("dashboard-list");
  const createTeamForm = document.getElementById("create-team-form");
  const createMemberForm = document.getElementById("create-member-form");
  const memberTeamSelect = document.getElementById("member-team-id");
  const messageDiv = document.getElementById("message");
  let currentTeams = [];

  function actorParams() {
    return new URLSearchParams({
      actor_role: roleSelect.value,
      actor_email: actorEmailInput.value.trim(),
    });
  }

  function showMessage(text, type = "success") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 4000);
  }

  function toggleMode() {
    const isManager = roleSelect.value === "manager";
    createTeamForm.querySelector("button").disabled = !isManager;
    createMemberForm.querySelector("button").disabled = !isManager;
    modeMessage.textContent = isManager
      ? "Manager mode: add, update and delete actions are enabled."
      : "View only mode: you can see details but cannot add, update or delete.";
  }

  function populateTeamSelect(teams) {
    memberTeamSelect.innerHTML = "";
    teams.forEach((team) => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = `${team.name} (${team.id})`;
      memberTeamSelect.appendChild(option);
    });
  }

  async function updateTeam(team) {
    const name = prompt("Team name", team.name);
    if (!name) return;
    const description = prompt("Description", team.description || "") || "";
    const teamEmail = prompt("Team email", team.team_email);
    if (!teamEmail) return;
    const teamContact = prompt("Team contact", team.team_contact || "") || "";

    const response = await fetch(`/teams/${team.id}?${actorParams()}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, team_email: teamEmail, team_contact: teamContact }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Failed to update team");
  }

  async function deleteTeam(teamId) {
    if (!confirm(`Delete team ${teamId}?`)) return;
    const response = await fetch(`/teams/${teamId}?${actorParams()}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Failed to delete team");
  }

  async function updateMember(teamId, member) {
    const name = prompt("Member name", member.name);
    if (!name) return;
    const title = prompt("Member title", member.title || "") || "";
    const skills = (prompt("Skills (comma separated)", (member.skills || []).join(", ")) || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const personalEmail = prompt("Personal email", member.personal_email);
    if (!personalEmail) return;
    const personalContact = prompt("Personal contact", member.personal_contact || "") || "";

    const response = await fetch(`/teams/${teamId}/members/${member.id}?${actorParams()}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        title,
        skills,
        personal_email: personalEmail,
        personal_contact: personalContact,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Failed to update member");
  }

  async function deleteMember(teamId, memberId) {
    if (!confirm(`Delete member ${memberId}?`)) return;
    const response = await fetch(`/teams/${teamId}/members/${memberId}?${actorParams()}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Failed to delete member");
  }

  function renderDashboard(teams) {
    dashboardList.innerHTML = "";
    if (!teams.length) {
      dashboardList.innerHTML = "<p>No teams found for this manager.</p>";
      return;
    }

    const isManager = roleSelect.value === "manager";
    teams.forEach((team) => {
      const card = document.createElement("div");
      card.className = "activity-card";

      const members = Object.values(team.members || {});
      const memberHtml = members.length
        ? members
            .map(
              (member) => `
                <li>
                  <strong>${member.name}</strong> (${member.title || "No title"})<br/>
                  Skills: ${(member.skills || []).join(", ") || "None"}<br/>
                  Team Email: ${team.team_email}<br/>
                  Personal Email: ${member.personal_email}<br/>
                  Personal Contact: ${member.personal_contact || "N/A"}
                  ${
                    isManager
                      ? `<div class="button-row">
                          <button class="member-update" data-team-id="${team.id}" data-member-id="${member.id}" type="button">Update Member</button>
                          <button class="member-delete" data-team-id="${team.id}" data-member-id="${member.id}" type="button">Delete Member</button>
                        </div>`
                      : ""
                  }
                </li>
              `
            )
            .join("")
        : "<li>No members yet.</li>";

      card.innerHTML = `
        <h4>${team.name}</h4>
        <p>${team.description || "No description"}</p>
        <p><strong>Manager:</strong> ${team.manager_email}</p>
        <p><strong>Team email:</strong> ${team.team_email}</p>
        <p><strong>Team contact:</strong> ${team.team_contact || "N/A"}</p>
        ${
          isManager
            ? `<div class="button-row">
                <button class="team-update" data-team-id="${team.id}" type="button">Update Team</button>
                <button class="team-delete" data-team-id="${team.id}" type="button">Delete Team</button>
              </div>`
            : ""
        }
        <h5>Members</h5>
        <ul>${memberHtml}</ul>
      `;
      dashboardList.appendChild(card);
    });

    dashboardList.querySelectorAll(".team-update").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const team = currentTeams.find((item) => item.id === button.dataset.teamId);
          if (!team) return;
          await updateTeam(team);
          await fetchDashboard();
          showMessage("Team updated");
        } catch (error) {
          showMessage(error.message, "error");
        }
      });
    });

    dashboardList.querySelectorAll(".team-delete").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await deleteTeam(button.dataset.teamId);
          await fetchDashboard();
          showMessage("Team deleted");
        } catch (error) {
          showMessage(error.message, "error");
        }
      });
    });

    dashboardList.querySelectorAll(".member-update").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const team = currentTeams.find((item) => item.id === button.dataset.teamId);
          if (!team) return;
          const member = (team.members && team.members[button.dataset.memberId]) || null;
          if (!member) return;
          await updateMember(button.dataset.teamId, member);
          await fetchDashboard();
          showMessage("Member updated");
        } catch (error) {
          showMessage(error.message, "error");
        }
      });
    });

    dashboardList.querySelectorAll(".member-delete").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await deleteMember(button.dataset.teamId, button.dataset.memberId);
          await fetchDashboard();
          showMessage("Member deleted");
        } catch (error) {
          showMessage(error.message, "error");
        }
      });
    });
  }

  async function fetchDashboard() {
    const managerEmail = actorEmailInput.value.trim();
    if (!managerEmail) {
      dashboardList.innerHTML = "<p>Please provide an email.</p>";
      return;
    }
    try {
      const response = await fetch(`/managers/${encodeURIComponent(managerEmail)}/dashboard`);
      const dashboard = await response.json();
      currentTeams = dashboard.teams || [];
      renderDashboard(currentTeams);
      populateTeamSelect(currentTeams);
    } catch (error) {
      dashboardList.innerHTML = "<p>Failed to load dashboard.</p>";
    }
  }

  createTeamForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`/teams?${actorParams()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.getElementById("team-name").value.trim(),
          description: document.getElementById("team-description").value.trim(),
          manager_email: actorEmailInput.value.trim(),
          team_email: document.getElementById("team-email").value.trim(),
          team_contact: document.getElementById("team-contact").value.trim(),
        }),
      });
      const result = await response.json();
      if (response.ok) {
        createTeamForm.reset();
        await fetchDashboard();
        showMessage(`Team created: ${result.name}`);
      } else {
        showMessage(result.detail || "Failed to create team", "error");
      }
    } catch (error) {
      showMessage("Failed to create team", "error");
    }
  });

  createMemberForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`/teams/${memberTeamSelect.value}/members?${actorParams()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.getElementById("member-name").value.trim(),
          title: document.getElementById("member-title").value.trim(),
          skills: document
            .getElementById("member-skills")
            .value.split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          personal_email: document.getElementById("member-personal-email").value.trim(),
          personal_contact: document.getElementById("member-personal-contact").value.trim(),
        }),
      });
      const result = await response.json();
      if (response.ok) {
        createMemberForm.reset();
        await fetchDashboard();
        showMessage(`Member added: ${result.name}`);
      } else {
        showMessage(result.detail || "Failed to add member", "error");
      }
    } catch (error) {
      showMessage("Failed to add member", "error");
    }
  });

  roleSelect.addEventListener("change", toggleMode);
  loadDashboardButton.addEventListener("click", fetchDashboard);
  toggleMode();
  fetchDashboard();
});
