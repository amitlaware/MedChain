const fs = require('fs');
const path = require('path');

const basePath = path.resolve(__dirname, 'crypto-config');

function buildCCP() {
  const hospitalCertPath = path.join(basePath, 'peerOrganizations/hospital.ehr.com/tlsca/tlsca.hospital.ehr.com-cert.pem');
  const doctorCertPath = path.join(basePath, 'peerOrganizations/doctor.ehr.com/tlsca/tlsca.doctor.ehr.com-cert.pem');
  const patientCertPath = path.join(basePath, 'peerOrganizations/patient.ehr.com/tlsca/tlsca.patient.ehr.com-cert.pem');

  const ccp = {
    name: 'ehr-network',
    version: '1.0.0',
    client: {
      organization: 'HospitalMSP',
      connection: {
        timeout: {
          peer: {
            endorser: '300'
          }
        }
      }
    },
    organizations: {
      HospitalMSP: {
        mspid: 'HospitalMSP',
        peers: ['peer0.hospital.ehr.com'],
        certificateAuthorities: ['ca-hospital']
      },
      DoctorMSP: {
        mspid: 'DoctorMSP',
        peers: ['peer0.doctor.ehr.com'],
        certificateAuthorities: ['ca-doctor']
      },
      PatientMSP: {
        mspid: 'PatientMSP',
        peers: ['peer0.patient.ehr.com'],
        certificateAuthorities: ['ca-patient']
      }
    },
    peers: {
      'peer0.hospital.ehr.com': {
        url: 'grpcs://localhost:7051',
        tlsCACerts: { pem: fs.readFileSync(hospitalCertPath, 'utf8') },
        grpcOptions: {
          'ssl-target-name-override': 'peer0.hospital.ehr.com',
          'hostnameOverride': 'peer0.hospital.ehr.com'
        }
      },
      'peer0.doctor.ehr.com': {
        url: 'grpcs://localhost:8051',
        tlsCACerts: { pem: fs.readFileSync(doctorCertPath, 'utf8') },
        grpcOptions: {
          'ssl-target-name-override': 'peer0.doctor.ehr.com',
          'hostnameOverride': 'peer0.doctor.ehr.com'
        }
      },
      'peer0.patient.ehr.com': {
        url: 'grpcs://localhost:9051',
        tlsCACerts: { pem: fs.readFileSync(patientCertPath, 'utf8') },
        grpcOptions: {
          'ssl-target-name-override': 'peer0.patient.ehr.com',
          'hostnameOverride': 'peer0.patient.ehr.com'
        }
      }
    },
    certificateAuthorities: {
      'ca-hospital': {
        url: 'https://localhost:7054',
        caName: 'ca-hospital',
        tlsCACerts: { pem: [fs.readFileSync(hospitalCertPath, 'utf8')] },
        httpOptions: { verify: false }
      },
      'ca-doctor': {
        url: 'https://localhost:8054',
        caName: 'ca-doctor',
        tlsCACerts: { pem: [fs.readFileSync(doctorCertPath, 'utf8')] },
        httpOptions: { verify: false }
      },
      'ca-patient': {
        url: 'https://localhost:9054',
        caName: 'ca-patient',
        tlsCACerts: { pem: [fs.readFileSync(patientCertPath, 'utf8')] },
        httpOptions: { verify: false }
      }
    }
  };

  const outputPath = path.join(__dirname, 'config', 'connection-profile.json');
  fs.writeFileSync(outputPath, JSON.stringify(ccp, null, 2));
  console.log('Successfully generated connection-profile.json');
}

buildCCP();
