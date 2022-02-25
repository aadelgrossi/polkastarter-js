import Account from '../models/base/Account';
import Contract from '../models/base/Contract';

class DeploymentService {
  async deploy(
    account: Account,
    contract: Contract,
    params: any[],
    callback: (args?: any) => void
  ) {
    return contract.deploy(
      account,
      contract.getABI(),
      contract.getJSON().bytecode,
      params,
      callback
    );
  }
}

export default DeploymentService;
