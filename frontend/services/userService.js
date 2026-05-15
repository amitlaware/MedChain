import api from "./api.js";

export async function listPatients(params = {}) {
  const { data } = await api.get("/users", { params: { ...params, role: "patient" } });
  return data;
}

export async function getUserProfile(userId) {
  const { data } = await api.get(`/users/${userId}`);
  return data;
}
