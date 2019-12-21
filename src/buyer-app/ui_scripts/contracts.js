$('body').on('click', '#load_buyers', (e) => {
	$('#buyersEl').empty();
	ipcRenderer.send('load-buyers');
	e.target.classList.add('clicked');
	setTimeout(() => {
		e.target.classList.remove('clicked');
	}, 1200);
});

ipcRenderer.send('load-buyers');

new_contract_form.addEventListener('submit', (e) => {
	const formData = new FormData(e.target);
	e.preventDefault();
	ipcRenderer.send('deploy-contract', formData.get('info'));
	new_contract_form.reset();
});

$('body').on('click', '.add-item', (e) => {
	e.preventDefault();
	$('.request-item').first().clone().insertBefore($(e.target).closest('.btn').parent());
});

$('body').on('click', '.remove-item', (e) => {
	e.preventDefault();
	$(e.target).closest('.request-item').remove();
});


ipcRenderer.on('contract-updated', (e, addr, students) => {
	ipcRenderer.send('load-buyers');
});

let savedContracts = {};
let queries = {};
let selectedAddr = null;

ipcRenderer.on('buyers-loaded', (e, data) => {
	let markup = '';
	let deployBtns = [];
	let forgetBtns = [];
	savedContracts = {};
	data.forEach(contract => {
		let content = `${contract.info ? `<h4 class='title'>${contract.info}</h4>` : ''}` + 
		`${contract.full_addr ? `Address: <i>${contract.full_addr}</i><br/>` : ''}` +
		`${contract.addr ? `N/B address: <i>${contract.addr}</i><br/>` : ''} ${contract.balance ? `Balance: <b>${contract.balance}</b><br/>` : ''}`;
		if (contract.isEmpty) {
			if (contract.createdName) {
				content += ` (${contract.createdName})`;
			}
			content += `<br/> <i>Contract was just created. Transfer some funds to it's address and deploy the contract after that to start working with it.</i><br/>`;
			if (contract.hasFile) {
				let btnId = `deploy-${contract.addr}`;
				deployBtns.push(btnId);
				content += ` <button id='${btnId}' ${contract.balance ? '' : 'disabled=disabled'} class='btn'>Deploy</button> `;
			} else {
				content += `<p>No .boc file found for this contract.</p>`;
			}
		}
		if (contract.balance && contract.balance < 1) {
			content += `<br/><b style='color:red;'>Warning, low balance!</b><br/>`
		}
		savedContracts[contract.addr] = contract;
		let fBtnId = `forget-${contract.addr}`;
		forgetBtns.push(fBtnId);
		content += ` <button id='${fBtnId}'} class='btn red'>Forget</button>`;
		const element = `<li class='${contract.isEmpty ? 'is-empty' : 'is-usable'}' data-addr='${contract.addr}'>${content}</li>`
		markup += element;
	});
	buyersEl.innerHTML = markup;
	deployBtns.forEach(btnId => {
		document.getElementById(btnId).addEventListener('click', (e) => {
			ipcRenderer.send('deploy-boc', btnId.replace('deploy-', ''));
		});
	});

	forgetBtns.forEach(btnId => {
		document.getElementById(btnId).addEventListener('click', (e) => {
			const addr = btnId.replace('forget-', '');
			if (confirm(`Are you sure you want to remove contract ${addr} from application?`))
			ipcRenderer.send('forget-contract', addr);
			e.stopPropagation();
		});
	});

	[].forEach.call(buyersEl.querySelectorAll('li.is-usable'), (liEl) => {
		liEl.addEventListener('click', (e) => {
			const addr = $(liEl).attr('data-addr');
			console.log(addr);
			if (liEl.parentElement.querySelector('.active')) {
				liEl.parentElement.querySelector('.active').classList.remove('active');
			}
			liEl.classList.add('active');
			selectedAddr = addr;

			$('.one-buyer-area').show();
			$('.order-send-area').hide();
			$('.responses-area').hide();
			$('#requestsEl').empty();
			ipcRenderer.send('load-orders', addr);
			// window.scrollTo(0, $('.one-buyer-area').offset().top - 20)
		});
	});
});

new_request_form.addEventListener('submit', (e) => {
	e.preventDefault();
	const items = [];
	$(e.target).find('.request-item').each( (i, cont) => { 
		if ($(cont).find('[name=itemId]').val()) {
			items.push({
				itemId: $(cont).find('[name=itemId]').val(),
				quantity: $(cont).find('[name=quantity]').val(),
			});
		} 
	});
	ipcRenderer.send('create-order',selectedAddr, items);
	new_request_form.reset();
});

let selectedQueryId = null;

ipcRenderer.on('orders-loaded', (e, addr, orders) => {
	console.log(orders);
	queries = {};
	if (selectedAddr == addr) {
		$('#requestsEl').empty();
		orders.forEach((order) => {
			queries[order.queryId] = order;
			let itemContent = `<div class='title order-id'>Query Id=<b>${order.queryId}</b></div>`;
			let tableContent = '<table><thead><tr><th>Item ID</th><th>Quantity</th></tr></thead><tbody>';
			order.goods.forEach(item => {
				tableContent += `<tr>
					<td>${item.itemId}</td>
					<td>${item.quantity}</td>
				</tr>`;
			});
			tableContent += '</tbody></table>';
			$('#requestsEl').append(`<li data-id='${order.queryId}'>${itemContent} ${tableContent}</li>`);
		});

		$('#requestsEl li').on('click', (e) => {
			const liEl = $(e.target).closest('li');
			liEl.parent().find('.active').removeClass('active');
			liEl.addClass('active');
			selectedQueryId = liEl.attr('data-id');
			$('.order-send-area').show();
			$('.responses-area').hide();
			ipcRenderer.send('load-order-responses', selectedAddr, selectedQueryId);
			$('#send_request_form [name=query_id]').val(selectedQueryId);
			$('#query_items').text(`Items: ${queries[selectedQueryId].goods.map(item => `${item.itemId} => ${item.quantity}`).join(', ')}`);
			// window.scrollTo(0, $('.order-send-area').offset().top - 20)
		});
	}
});

ipcRenderer.on('order-responses-loaded', (e,  addr, query_id, resps) => {
	if(addr == selectedAddr && query_id == selectedQueryId) {
		$('.responses-area h4').text(selectedQueryId);
		$('.responses-area').show();
		console.log(resps);
		$('#respsEl').empty();
		resps.forEach((order) => {
			let itemContent = `<div class='title'>Seller=<b>${order.seller_addr_full}</b></div>`;
			itemContent += `<div>Price=<b>${order.amount}</b></div>`;
			itemContent += `<div>Expires ${new Date(order.expiry*1000)}</b></div>`;
			let tableContent = '<table><thead><tr><th>Item ID</th><th>Quantity</th></tr></thead><tbody>';
			order.goods.forEach(item => {
				tableContent += `<tr>
					<td>${item.itemId}</td>
					<td>${item.quantity}</td>
				</tr>`;
			});
			tableContent += '</tbody></table>';
			$('#respsEl').append(`<li data-id='${order.seller_addr}'>${itemContent} ${tableContent}</li>`);
		});
	}
});

seller_info_form.addEventListener('submit', (e) => {
	e.preventDefault();
	const seller_addr = $(e.target).find('[name=seller_addr]').val();
	$('#send_request_form .btn').prop('disabled', true);
	ipcRenderer.send('load-seller-info', seller_addr, selectedAddr);
});


ipcRenderer.on('seller-info-loaded', (e, data) => {
	if (!data) {
		$('#seller_info').text("Can't load this seller information, probably the address is wrong.");
		return;
	}
	if (data.error) {
		if (data.error.isClosed) {
			$('#seller_info').text("This seller is closed and doesn't accept new requests");
			return;
		}
		$('#seller_info').text("Can't load this seller information, probably the address is wrong.");
		return;
	}
	data.price = data.price / 1000000000;
	let sellerInfo = `<p>Name: <b>${data.info}</b></p><p>Request price is: <b>${data.price}</b> (please add at least 0.1 Gram to the request to cover gas prices)</p>`;
	if (data.items) {
		sellerInfo += `<p>Sells following items: ${data.items.join(', ')}</p>`;
	}
	if (data.price > savedContracts[selectedAddr].balance) {
		sellerInfo += `<p style='color:red;'>Not enough grams to pay for the request!<p>`
		$('#seller_info').html(sellerInfo);
		return;
	}
	$('#seller_info').html(sellerInfo);
	$('#send_request_form .btn').prop('disabled', false);
	$('#send_request_form [name=amount]').val(data.price + 0.1);
	$('#send_request_form [name=seller_addr]').val(data.seller_addr);
	$('#send_request_form [name=seller_addr_int]').val(data.seller_addr_int);
	
});

send_request_form.addEventListener('submit', (e) => {
	e.preventDefault();
	$('#send_request_form .btn').prop('disabled', true);

	const amount = $('#send_request_form [name=amount]').val();
	const query_id = $('#send_request_form [name=query_id]').val();
	const seller_addr_int = $('#send_request_form [name=seller_addr_int]').val();

	ipcRenderer.send('send-price-request', selectedAddr, query_id, amount, seller_addr_int);
	send_request_form.reset();
	seller_info_form.reset();
	$('#seller_info').html('Request is sent.');
});