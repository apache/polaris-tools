/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
*/

import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Input, Space, Checkbox, Image, Spin, message } from 'antd';

export default function Login(props) {

    const [ loginForm ] = Form.useForm();
    const [ checked, setChecked ] = useState(true);

    return (
        <Modal centered={true} mask={false} title={<Space><Image width={30} src="/logo.png" preview={false}/> Apache Polaris (incubating) </Space>} open={true} okText="Login" cancelText="Cancel" closable={false} onOk={() => loginForm.submit()} onCancel={() => loginForm.resetFields()}>
            <Form name="login" form={loginForm} labelCol={{ span: 8 }} wrapperCol={{ span: 16 }} autoComplete="off" onFinish={(values) => {

                const fetchUser = () => {
                    fetch('/api/catalog/v1/oauth/tokens', {
                        method: 'POST',
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: new URLSearchParams(
                            {
                                client_id: values.username,
                                client_secret: values.password,
                                scope: 'PRINCIPAL_ROLE:ALL',
                                grant_type: 'client_credentials'
                            }
                        )
                    })
                    .then((response) => {
                        if (!response.ok) {
                            throw new Error('Authentication failed (' + response.status + ')');
                        }
                        return response.json();
                    })
                    .then((data) => {
                        props.setUser(values.username);
                        props.setToken(data.access_token);
                    })
                    .catch((error) => {
                        message.error(error.message);
                        console.error(error);
                    })
                };

                useEffect(fetchUser(), []);

                if (!props.token) {
                    return(<Spin/>);
                }

            }} onKeyUp={(event) => {
                             if (event.keyCode === 13) {
                               loginForm.submit();
                             }
                         }}>
                <Form.Item name="username" label="Username" rules={[{ required: true, message: 'The username is required' }]}><Input allowClear={true} /></Form.Item>
                <Form.Item name="password" label="Password" rules={[{ required: true, message: 'The password is required' }]}><Input.Password allowClear={true} /></Form.Item>
            </Form>
        </Modal>
    );

}
