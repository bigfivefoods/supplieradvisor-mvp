const companyRoleState = {
  loading: true,
  role: null,
};

function useCompanyRole() {
  return companyRoleState;
}

module.exports = { companyRoleState, useCompanyRole };
