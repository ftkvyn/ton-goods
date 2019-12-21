function validateConfig(el) {
	ipcRenderer.send('validate-config');

	ipcRenderer.on('validate-config-result', (e, result) => {
		console.log(result);
		if (result.success) {
			el.innerHTML = '✔ Config is valid.';
		} else {
			const errors = [];
			if (result.noBin) {
				errors.push("no 'lite-client-bin' section in config");
			}
			if (result.liteClientNotFound) {
				errors.push(`lite client not found under <b>${result.liteClientNotFound}</b>`);
			}
			if (result.noLiteClientConfig) {
				errors.push("no 'lite-client-config' section in config");
			}
			if (result.liteClientConfigNotFound) {
				errors.push(`lite client config not found under <b>${result.liteClientConfigNotFound}</b>`);
			}

			if (result.errorReadingLiteClientConfig) {
				errors.push(`error reading config file: <b>${JSON.stringify(result.errorReadingLiteClientConfig)}</b>`);
			}
			if (result.noData) {
				errors.push(`no 'data-storage' section in config`);
			}

			if (result.errorReadingData) {
				errors.push(`error reading data file: <b>${JSON.stringify(result.errorReadingData)}</b>`);
			}

			if (result.noFiftFolder) {
				errors.push(`no 'fift-folder' section in config`);
			}
			if (result.missingScripts) {
				errors.push(`fift scripts missing: ${result.missingScripts.reduce((acc, val) => acc + ' ' + val)}`, '');
			}
			if (result.dataSaveError) {
				errors.push(`error saving data ${JSON.stringify(result.dataSaveError)}`);
			}

			if (!errors.length) {
				errors.push(`Unknown error ${JSON.stringify(result)}`);
			}

			const errorsHtml = errors.reduce((acc, val) => acc + `❌ ${val}; <br/>`, '');
			el.innerHTML = errorsHtml;
		}
	});
}