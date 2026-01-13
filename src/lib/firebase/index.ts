// Firebase module exports
export { app, auth, db, storage, initializeFirebase } from './client';
export { getAdminFirestore, getAdminAuth, getAdminStorage, initializeAdmin } from './admin';
export {
  createCertificate,
  getCertificate,
  updateCertificate,
  incrementViewCount,
  deleteCertificate,
  getCertificatesByTemplate,
  getCertificatesByRecipient,
  batchCreateCertificates,
} from './certificates';
export {
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  getUserTemplates,
  getPublicTemplates,
  searchTemplates,
  incrementCertificateCount,
  toggleTemplateStar,
  hasUserStarredTemplate,
  setTemplateVisibility,
  saveOrUpdateTemplate,
  type Template,
  type CreateTemplateInput,
  type UpdateTemplateInput,
} from './templates';
