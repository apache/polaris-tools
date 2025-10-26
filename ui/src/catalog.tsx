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
import { Breadcrumb, Card, Form, Input, Select, Tabs, Collapse, Divider, Button, Space } from 'antd';
import { HomeOutlined, ApartmentOutlined, AmazonOutlined, GoogleOutlined, CloudOutlined, FileSyncOutlined, SaveOutlined, PauseCircleOutlined } from '@ant-design/icons';

function S3() {

    return(
        <>
        <Form.Item name="s3.roleArn" label="Role ARN">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.externalId" label="External ID">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.userArn" label="User ARN">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.region" label="Region">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.endpoint" label="Endpoint">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.endpointInternal" label="Endpoint internal">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.pathStyleAccess" label="Path style access">
            <Select options={[
                { value: 'true', label: 'Enabled' },
                { value: 'false', label: 'Disabled' }
            ]} />
        </Form.Item>
        <Form.Item name="s3.stsUnavailable" label="STS">
            <Select options={[
                { value: 'false', label: 'Enabled' },
                { value: 'true', label: 'Disabled' }
            ]} />
        </Form.Item>
        <Form.Item name="s3.stsEndpoint" label="STS endpoint">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.accountId" label="Account ID">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="s3.partition" label="Partition">
            <Input allowClear={true} />
        </Form.Item>
        </>
    );
}

function GCP() {

    return(
        <>
        <Form.Item name="gcp.serviceAccount" label="Service account">
            <Input allowClear={true} />
        </Form.Item>
        </>
    );

}

function Azure() {

    return(
        <>
        <Form.Item name="azure.tenantId" label="Tenant ID">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="azure.multiTenantAppName" label="Multi tenant app name">
            <Input allowClear={true} />
        </Form.Item>
        <Form.Item name="azure.consentUrl" label="Consent URL">
            <Input allowClear={true} />
        </Form.Item>
        </>
    );

}

export default function Catalog(props) {

    const bearer = 'Bearer ' + props.token;

    const [ catalogForm ] = Form.useForm();

    const tabItems = [
        {
            key: 's3',
            label: 'S3',
            icon: <AmazonOutlined/>,
            children: <S3/>
        },
        {
            key: 'gcp',
            label: 'GCP',
            icon: <GoogleOutlined/>,
            children: <GCP/>
        },
        {
            key: 'azure',
            label: 'Azure',
            icon: <CloudOutlined/>,
            children: <Azure/>
        }
    ];

    const onFinish = (values) => {
        const request = {
          'catalog': {
            'name': values.name,
            'properties': {
                'default-base-location': values.location
            },
            'storageConfigInfo': {
                'storageType': values.storageType,
                'allowedLocations': values.allowedLocations
            }
          }
        };
        const createCatalog = () => {
            fetch('/api/management/v1/catalogs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Polaris-Realm': 'POLARIS',
                    'Authorization': bearer
                }
            })
            .then((response) => {
                
            })
        };
        console.log(request);
    };

    return(
      <>
      <Breadcrumb items={[ { title: <Link to="/"><HomeOutlined/></Link> }, { title: <ApartmentOutlined/> } ]} />
      <Card title="Create Catalog" style={{ width: '100%' }}>
        <Form name="catalog" form={catalogForm} labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            style={{ width: '100%' }}
            onFinish={onFinish}>
            <Form.Item name="name" label="Name" rules={[{ required: true, message: 'The catalog name is required' }]}>
                <Input allowClear={true} />
            </Form.Item>
            <Form.Item name="storageType" label="Storage Type" rules={[{ required: true, message: 'The storage type is required' }]}>
                <Select options={[
                    { value: 'S3', label: 'S3' },
                    { value: 'GCP', label: 'GCP' },
                    { value: 'AZURE', label: 'Azure' },
                    { value: 'FILE', label: 'File' }
                ]}/>
            </Form.Item>
            <Form.Item name="location" label="Default Base Location">
                <Input allowClear={true} />
            </Form.Item>
            <Form.Item name="allowedLocations" label="Allowed locations">
                <Select mode="tags" />
            </Form.Item>
            <Collapse items={[
                { key: '1', label: 'Storage specific configuration', children: <Tabs centered items={tabItems} /> }
            ]}/>
            <Divider />
            <Collapse items={[
                { key: '1', label: 'Additional properties', children: <Form.Item name="properties" label="Additional properties"><Select mode="tags"/></Form.Item> }
            ]}/>
            <Divider />
            <Form.Item label={null}>
                <Space>
                    <Button type="primary" icon={<SaveOutlined/>} onClick={() => catalogForm.submit()}>Save</Button>
                    <Button icon={<PauseCircleOutlined/>} onClick={() => catalogForm.resetFields()}>Cancel</Button>
                </Space>
            </Form.Item>
        </Form>
      </Card>
      </>
    );

}