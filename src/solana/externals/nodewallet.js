export default class NodeWallet {
  constructor(keypair) {
    this.payer = keypair;
  }

  async signTransaction(tx) {
    tx.partialSign(this.payer);
    return tx;
  }

  async signAllTransactions(txs) {
    return txs.map((t) => {
      t.partialSign(this.payer);
      return t;
    });
  }

  get publicKey() {
    console.log(this);
    return this.payer.publicKey;
  }
}
