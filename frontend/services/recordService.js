import api from "./api.js";

export async function uploadRecord({ file, patientId, hospitalId }) {
  const form = new FormData();
  form.append("file", file);
  form.append("patientId", patientId);
  form.append("hospitalId", hospitalId);

  const { data } = await api.post("/records/upload", form, {
    headers: { "Content-Type": "multipart/form-data" }
  });

  return data;
}

export async function getMyRecords() {
  const { data } = await api.get("/records/me");
  return data;
}

export async function listPatientRecords(patientId) {
  const { data } = await api.get(`/records/patient/${patientId}`);
  return data;
}

export async function downloadRecordPdf(recordId) {
  const response = await api.get(`/records/${recordId}/pdf`, { responseType: "arraybuffer" });
  return response;
}

export async function grantAccess(recordId, doctorId, options = {}) {
  const body = { doctorId, canView: options.canView ?? true, expires: options.expires ?? "" };
  const { data } = await api.post(`/records/${recordId}/grant`, body);
  return data;
}

export async function revokeAccess(recordId, doctorId) {
  const { data } = await api.post(`/records/${recordId}/revoke`, { doctorId });
  return data;
}

export async function requestTransfer(recordId, payload) {
  const { data } = await api.post(`/records/${recordId}/transfer-request`, payload);
  return data;
}
