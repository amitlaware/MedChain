import api from "./api.js";

export async function listHospitals() {
  const { data } = await api.get("/hospitals");
  return data;
}
