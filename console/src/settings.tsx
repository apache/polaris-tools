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
import { Link } from 'react-router-dom';
import { Breadcrumb, Card, Form, Input, Space, Button, message } from 'antd';
import { HomeOutlined, SettingOutlined, SaveOutlined, PauseCircleOutlined } from '@ant-design/icons';

export default function Settings(props) {

    const initialValues = {
        realmHeader: props.realmHeader,
        realm: props.realm
    };

    const [ settingsForm ] = Form.useForm();

    const onFinish = (values) => {
        props.setRealmHeader(values.realmHeader);
        props.setRealm(values.realm);
        message.info('Settings updated');
    };

    return(
        <>
        <Breadcrumb items={[ { title: <Link to="/"><HomeOutlined/></Link> }, { title: <SettingOutlined/> } ]} />
        <Card title="Settings" style={{ width: '100%' }}>
            <Form name="settings" form={settingsForm} labelCol={{ span: 8 }}
                wrapperCol={{ span: 16 }}
                style={{ style: '100%' }}
                initialValues={initialValues} onFinish={onFinish}>
                <Form.Item name="realmHeader" label="Realm Header" rules={[{ required: true, message: 'The Realm Header is required' }]}>
                    <Input allowClear={true} />
                </Form.Item>
                <Form.Item name="realm" label="Realm" rules={[{ required: true, message: 'The Realm is required' }]}>
                    <Input allowClear={true} />
                </Form.Item>
                <Form.Item label={null}>
                    <Space>
                        <Button type="primary" icon={<SaveOutlined/>} onClick={() => settingsForm.submit()}>Save</Button>
                        <Button icon={<PauseCircleOutlined/>} onClick={() => settingsForm.resetFields()}>Cancel</Button>
                    </Space>
                </Form.Item>
            </Form>
        </Card>
        </>
    );

}